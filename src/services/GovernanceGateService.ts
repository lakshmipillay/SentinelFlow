/**
 * SentinelFlow Governance Gate Service
 * Implements mandatory governance gate enforcement with human-in-the-loop controls
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * - Governance gates are mandatory architectural boundaries
 * - No workflow can bypass governance approval
 * - Block decisions immediately terminate workflows
 * - All governance decisions generate audit artifacts
 * 
 * Implements Requirements 4.1, 4.3, 4.4 - Governance gate enforcement and decision validation
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowState, GovernanceDecision, AuditEvent } from '../types/workflow';
import { WorkflowStateManager } from '../core/WorkflowStateManager';

export interface GovernanceRequest {
  requestId: string;
  workflowId: string;
  timestamp: string;
  recommendedAction: string;
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
    impactDescription: string;
    // Enhanced blast radius information for requirement 4.2
    dependencyAnalysis: {
      directDependencies: string[];
      cascadeRisk: 'low' | 'medium' | 'high';
      criticalPath: boolean;
      totalPotentialImpact: number;
    };
    riskFactors: {
      confidenceLevel: number;
      serviceCount: number;
      actionType: string;
      businessHoursImpact: boolean;
      criticalServicesAffected: string[];
    };
  };
  policyConflicts: string[];
  contextData: {
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  };
  status: 'pending' | 'approved' | 'approved_with_restrictions' | 'blocked';
  createdAt: string;
  decidedAt?: string;
  decision?: GovernanceDecision;
}

export interface GovernanceApprovalInterface {
  requestId: string;
  workflowId: string;
  approvalOptions: {
    approve: {
      available: boolean;
      label: 'Approve';
      color: 'green';
      description: 'Proceed with recommended action';
    };
    approveWithRestrictions: {
      available: boolean;
      label: 'Approve with Restrictions';
      color: 'yellow';
      description: 'Proceed with additional constraints';
    };
    block: {
      available: boolean;
      label: 'Block';
      color: 'red';
      description: 'Terminate workflow - action not approved';
    };
  };
  requiredFields: {
    rationale: {
      required: true;
      minLength: 10;
      placeholder: 'Provide rationale for your decision...';
    };
    restrictions?: {
      required: boolean;
      placeholder: 'Specify restrictions if approving with constraints...';
    };
  };
}

/**
 * Governance Gate Service - Enforces mandatory human approval gates
 * Implements architectural boundary between analysis and action
 */
export class GovernanceGateService extends EventEmitter {
  private stateManager: WorkflowStateManager;
  private pendingRequests: Map<string, GovernanceRequest> = new Map();
  private completedRequests: Map<string, GovernanceRequest> = new Map();

  constructor(stateManager: WorkflowStateManager) {
    super();
    this.stateManager = stateManager;
  }

  /**
   * Create governance gate request when workflow reaches GOVERNANCE_PENDING
   * Implements Requirements 4.1 - Mandatory governance gates
   */
  async createGovernanceRequest(
    workflowId: string,
    recommendedAction: string,
    contextData: {
      incidentSummary: string;
      agentFindings: string[];
      correlationSummary: string;
      confidenceLevel: number;
    }
  ): Promise<GovernanceRequest> {
    const workflow = this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Validate workflow is in correct state for governance gate
    if (workflow.currentState !== WorkflowState.GOVERNANCE_PENDING) {
      throw new Error(
        `Cannot create governance request - workflow is in ${workflow.currentState} state, expected GOVERNANCE_PENDING`
      );
    }

    const requestId = uuidv4();
    const now = new Date().toISOString();

    // Generate blast radius assessment based on context
    const blastRadiusAssessment = this.generateBlastRadiusAssessment(contextData, recommendedAction);
    
    // Detect policy conflicts based on recommended action
    const policyConflicts = this.detectPolicyConflicts(recommendedAction, contextData);

    const governanceRequest: GovernanceRequest = {
      requestId,
      workflowId,
      timestamp: now,
      recommendedAction,
      blastRadiusAssessment,
      policyConflicts,
      contextData,
      status: 'pending',
      createdAt: now
    };

    // Store pending request
    this.pendingRequests.set(requestId, governanceRequest);

    // Emit governance request event for UI notification
    this.emit('governanceRequired', {
      type: 'governance_required',
      workflowId,
      timestamp: now,
      payload: governanceRequest
    });

    return governanceRequest;
  }

  /**
   * Get governance approval interface for a request
   * Provides structured UI interface for human decision-making
   */
  getApprovalInterface(requestId: string): GovernanceApprovalInterface | null {
    const request = this.pendingRequests.get(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    // Determine which approval options are available based on risk assessment
    const riskLevel = request.blastRadiusAssessment.riskLevel;
    const hasConflicts = request.policyConflicts.length > 0;

    return {
      requestId,
      workflowId: request.workflowId,
      approvalOptions: {
        approve: {
          available: riskLevel !== 'critical' && !hasConflicts,
          label: 'Approve',
          color: 'green',
          description: 'Proceed with recommended action'
        },
        approveWithRestrictions: {
          available: true, // Always available as a safer option
          label: 'Approve with Restrictions',
          color: 'yellow',
          description: 'Proceed with additional constraints'
        },
        block: {
          available: true, // Always available - governance has veto authority
          label: 'Block',
          color: 'red',
          description: 'Terminate workflow - action not approved'
        }
      },
      requiredFields: {
        rationale: {
          required: true,
          minLength: 10,
          placeholder: 'Provide rationale for your decision...'
        },
        restrictions: {
          required: false, // Only required if approving with restrictions
          placeholder: 'Specify restrictions if approving with constraints...'
        }
      }
    };
  }

  /**
   * Process governance decision from human approver
   * Implements Requirements 4.3, 4.4 - Three-option approval and decision validation
   */
  async processGovernanceDecision(
    requestId: string,
    decision: 'approve' | 'approve_with_restrictions' | 'block',
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ): Promise<{
    success: boolean;
    governanceDecision?: GovernanceDecision;
    workflowTerminated?: boolean;
    validationErrors?: string[];
  }> {
    // Validate governance decision
    const validationResult = this.validateGovernanceDecision(
      requestId, decision, rationale, approver, restrictions
    );

    if (!validationResult.isValid) {
      return {
        success: false,
        validationErrors: validationResult.errors
      };
    }

    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return {
        success: false,
        validationErrors: ['Governance request not found']
      };
    }

    const now = new Date().toISOString();

    // Create governance decision
    const governanceDecision: GovernanceDecision = {
      decision,
      rationale,
      approver,
      timestamp: now,
      restrictions: restrictions || [],
      blastRadiusAssessment: request.blastRadiusAssessment
    };

    // Update request status
    request.status = decision === 'approve' ? 'approved' : 
                   decision === 'approve_with_restrictions' ? 'approved_with_restrictions' : 'blocked';
    request.decidedAt = now;
    request.decision = governanceDecision;

    // Move from pending to completed
    this.pendingRequests.delete(requestId);
    this.completedRequests.set(requestId, request);

    // Add governance decision to workflow
    const workflow = this.stateManager.getWorkflow(request.workflowId);
    if (workflow) {
      workflow.governanceDecision = governanceDecision;
      workflow.updatedAt = now;

      // Create audit event for governance decision
      const auditEvent: AuditEvent = {
        eventId: uuidv4(),
        workflowId: request.workflowId,
        eventType: 'governance_decision',
        timestamp: now,
        actor: 'human',
        details: { governanceDecision },
        immutable: true
      };
      
      workflow.auditTrail.push(auditEvent);
      await this.stateManager.persistState(request.workflowId);
    }

    // Handle decision outcome
    let workflowTerminated = false;
    
    if (decision === 'block') {
      // Block decision immediately terminates workflow
      await this.stateManager.terminateWorkflow(
        request.workflowId, 
        `Governance decision: ${rationale}`
      );
      workflowTerminated = true;
    } else {
      // Approved decisions allow transition to ACTION_PROPOSED
      await this.stateManager.transitionTo(request.workflowId, WorkflowState.ACTION_PROPOSED);
    }

    // Emit governance decision event
    this.emit('governanceDecision', {
      type: 'governance_decision',
      workflowId: request.workflowId,
      timestamp: now,
      payload: {
        decision: governanceDecision,
        workflowTerminated,
        requestId
      }
    });

    return {
      success: true,
      governanceDecision,
      workflowTerminated
    };
  }

  /**
   * Validate governance decision input
   * Implements Requirements 4.3, 4.4 - Decision validation
   */
  private validateGovernanceDecision(
    requestId: string,
    decision: string,
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate request exists and is pending
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      errors.push('Governance request not found');
      return { isValid: false, errors };
    }

    if (request.status !== 'pending') {
      errors.push(`Request already processed with status: ${request.status}`);
    }

    // Validate decision type
    const validDecisions = ['approve', 'approve_with_restrictions', 'block'];
    if (!validDecisions.includes(decision)) {
      errors.push(`Invalid decision type. Must be one of: ${validDecisions.join(', ')}`);
    }

    // Validate rationale
    if (!rationale || typeof rationale !== 'string') {
      errors.push('Rationale is required');
    } else if (rationale.trim().length < 10) {
      errors.push('Rationale must be at least 10 characters long');
    }

    // Validate approver
    if (!approver || !approver.id || !approver.role) {
      errors.push('Valid approver information is required (id and role)');
    }

    // Validate restrictions for approve_with_restrictions
    if (decision === 'approve_with_restrictions') {
      if (!restrictions || restrictions.length === 0) {
        errors.push('Restrictions are required when approving with restrictions');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate comprehensive blast radius assessment based on context data
   * Implements Requirements 4.2 - Enhanced blast radius assessment with dependency analysis
   */
  private generateBlastRadiusAssessment(
    contextData: {
      incidentSummary: string;
      agentFindings: string[];
      correlationSummary: string;
      confidenceLevel: number;
    },
    recommendedAction: string
  ): GovernanceRequest['blastRadiusAssessment'] {
    // Extract affected services with enhanced analysis
    const affectedServices = this.extractAffectedServices(contextData);
    
    // Analyze service dependencies for cascade impact
    const dependencyChain = this.analyzeDependencyChain(affectedServices, contextData);
    
    // Calculate comprehensive risk level
    const riskLevel = this.calculateEnhancedRiskLevel(
      contextData.confidenceLevel, 
      affectedServices.length,
      dependencyChain,
      recommendedAction,
      contextData
    );
    
    // Determine reversibility with detailed analysis
    const reversible = this.assessReversibility(recommendedAction);
    
    // Generate detailed impact assessment
    const impactDescription = this.generateDetailedImpactDescription(
      affectedServices, 
      riskLevel, 
      dependencyChain,
      reversible
    );

    // Identify critical services affected
    const criticalServices = ['database', 'auth', 'api', 'payment'];
    const criticalServicesAffected = affectedServices.filter(service => 
      criticalServices.includes(service)
    );

    // Check business hours impact
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    const businessHoursImpact = isBusinessHours && isWeekday && affectedServices.length > 0;

    return {
      affectedServices,
      riskLevel,
      reversible,
      impactDescription,
      dependencyAnalysis: {
        directDependencies: dependencyChain.directDependencies,
        cascadeRisk: dependencyChain.cascadeRisk,
        criticalPath: dependencyChain.criticalPath,
        totalPotentialImpact: affectedServices.length + dependencyChain.directDependencies.length
      },
      riskFactors: {
        confidenceLevel: contextData.confidenceLevel,
        serviceCount: affectedServices.length,
        actionType: this.categorizeActionType(recommendedAction),
        businessHoursImpact,
        criticalServicesAffected
      }
    };
  }

  /**
   * Categorize action type for risk assessment
   */
  private categorizeActionType(recommendedAction: string): string {
    const action = recommendedAction.toLowerCase();
    
    // Check for recovery actions first (more specific)
    if (action.includes('rollback') || action.includes('revert')) {
      return 'recovery';
    } else if (action.includes('delete') || action.includes('drop') || action.includes('destroy')) {
      return 'destructive';
    } else if (action.includes('restart') || action.includes('reboot')) {
      return 'disruptive';
    } else if (action.includes('deploy') || action.includes('update') || action.includes('modify')) {
      return 'change';
    } else if (action.includes('scale') || action.includes('resize')) {
      return 'scaling';
    } else {
      return 'maintenance';
    }
  }

  /**
   * Extract affected services with enhanced pattern recognition
   * Implements comprehensive service identification from incident context
   */
  private extractAffectedServices(contextData: any): string[] {
    const services = new Set<string>();
    
    // Enhanced service patterns for better detection
    const servicePatterns = {
      'database': ['database', 'db', 'mysql', 'postgres', 'mongodb', 'redis', 'sql'],
      'api': ['api', 'rest', 'graphql', 'endpoint', 'service', 'microservice'],
      'frontend': ['frontend', 'ui', 'web', 'client', 'react', 'angular', 'vue'],
      'auth': ['auth', 'authentication', 'authorization', 'login', 'oauth', 'jwt'],
      'payment': ['payment', 'billing', 'stripe', 'paypal', 'transaction', 'checkout'],
      'user-service': ['user', 'account', 'profile', 'customer'],
      'admin': ['admin', 'dashboard', 'management', 'control'],
      'notification': ['notification', 'email', 'sms', 'push', 'alert'],
      'search': ['search', 'elasticsearch', 'solr', 'index'],
      'cache': ['cache', 'redis', 'memcached', 'cdn'],
      'queue': ['queue', 'kafka', 'rabbitmq', 'sqs', 'pubsub'],
      'storage': ['storage', 's3', 'blob', 'file', 'upload'],
      'monitoring': ['monitoring', 'metrics', 'logs', 'datadog', 'prometheus'],
      'load-balancer': ['load balancer', 'lb', 'nginx', 'haproxy', 'alb'],
      'gateway': ['gateway', 'proxy', 'ingress', 'router']
    };
    
    // Analyze incident summary with enhanced pattern matching
    const summary = contextData.incidentSummary.toLowerCase();
    Object.entries(servicePatterns).forEach(([service, patterns]) => {
      if (patterns.some(pattern => summary.includes(pattern))) {
        services.add(service);
      }
    });

    // Analyze agent findings with context awareness
    contextData.agentFindings.forEach((finding: string) => {
      const findingLower = finding.toLowerCase();
      Object.entries(servicePatterns).forEach(([service, patterns]) => {
        if (patterns.some(pattern => findingLower.includes(pattern))) {
          services.add(service);
        }
      });
    });

    // Analyze correlation summary for additional services
    const correlationLower = contextData.correlationSummary.toLowerCase();
    Object.entries(servicePatterns).forEach(([service, patterns]) => {
      if (patterns.some(pattern => correlationLower.includes(pattern))) {
        services.add(service);
      }
    });

    return Array.from(services);
  }

  /**
   * Analyze service dependency chains for cascade impact assessment
   * Implements dependency analysis for comprehensive blast radius calculation
   */
  private analyzeDependencyChain(affectedServices: string[], contextData: any): {
    directDependencies: string[];
    cascadeRisk: 'low' | 'medium' | 'high';
    criticalPath: boolean;
  } {
    // Define service dependency relationships
    const dependencyMap: Record<string, string[]> = {
      'frontend': ['api', 'auth', 'cdn', 'load-balancer'],
      'api': ['database', 'auth', 'cache', 'queue'],
      'auth': ['database', 'cache'],
      'payment': ['api', 'database', 'notification', 'queue'],
      'user-service': ['database', 'auth', 'cache'],
      'admin': ['api', 'auth', 'database'],
      'notification': ['queue', 'api'],
      'search': ['database', 'cache'],
      'monitoring': ['database', 'api'],
      'gateway': ['api', 'load-balancer', 'auth']
    };

    const directDependencies = new Set<string>();
    let criticalPath = false;

    // Calculate direct dependencies
    affectedServices.forEach(service => {
      const deps = dependencyMap[service] || [];
      deps.forEach(dep => directDependencies.add(dep));
      
      // Check for critical path services
      if (['database', 'auth', 'api'].includes(service)) {
        criticalPath = true;
      }
    });

    // Calculate cascade risk based on dependency count and critical services
    let cascadeRisk: 'low' | 'medium' | 'high' = 'low';
    const totalImpact = affectedServices.length + directDependencies.size;
    
    if (criticalPath || totalImpact >= 8) {
      cascadeRisk = 'high';
    } else if (totalImpact >= 5 || affectedServices.some(s => ['api', 'database'].includes(s))) {
      cascadeRisk = 'medium';
    }

    return {
      directDependencies: Array.from(directDependencies),
      cascadeRisk,
      criticalPath
    };
  }

  /**
   * Calculate enhanced risk level with comprehensive factors
   * Implements multi-factor risk assessment for governance decisions
   */
  private calculateEnhancedRiskLevel(
    confidenceLevel: number, 
    serviceCount: number,
    dependencyChain: { directDependencies: string[]; cascadeRisk: string; criticalPath: boolean },
    recommendedAction: string,
    contextData: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Confidence level factor (0-3 points) - reduced from 0-4
    if (confidenceLevel < 0.3) riskScore += 3;
    else if (confidenceLevel < 0.5) riskScore += 2;
    else if (confidenceLevel < 0.7) riskScore += 1;
    // 0.7+ gets 0 points (good confidence)

    // Service count factor (0-2 points) - reduced from 0-3
    if (serviceCount >= 5) riskScore += 2;
    else if (serviceCount >= 3) riskScore += 1;
    // 1-2 services get 0 points

    // Dependency cascade factor (0-2 points) - reduced from 0-3
    if (dependencyChain.cascadeRisk === 'high') riskScore += 2;
    else if (dependencyChain.cascadeRisk === 'medium') riskScore += 1;
    // Low cascade risk gets 0 points

    // Critical path factor (0-1 point) - reduced from 0-2
    if (dependencyChain.criticalPath) riskScore += 1;

    // Action type factor (0-2 points) - reduced from 0-3
    const action = recommendedAction.toLowerCase();
    if (action.includes('delete') || action.includes('drop') || action.includes('destroy')) {
      riskScore += 2;
    } else if (action.includes('restart') || action.includes('reboot') || action.includes('deploy')) {
      riskScore += 1;
    }
    // Other actions get 0 points

    // Business hours factor (0-1 point) - unchanged
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    
    if (isBusinessHours && isWeekday && serviceCount > 0) {
      riskScore += 1;
    }

    // Convert score to risk level with adjusted thresholds
    if (riskScore >= 8) return 'critical';  // Increased from 10
    if (riskScore >= 5) return 'high';     // Decreased from 7
    if (riskScore >= 3) return 'medium';   // Decreased from 4
    return 'low';
  }

  /**
   * Generate detailed impact description with dependency analysis
   * Implements comprehensive impact assessment for governance decisions
   */
  private generateDetailedImpactDescription(
    services: string[], 
    riskLevel: string,
    dependencyChain: { directDependencies: string[]; cascadeRisk: string; criticalPath: boolean },
    reversible: boolean
  ): string {
    if (services.length === 0) {
      return `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk action with unknown service impact`;
    }
    
    const totalImpact = services.length + dependencyChain.directDependencies.length;
    const reversibilityNote = reversible ? 'reversible' : 'irreversible';
    const criticalPathNote = dependencyChain.criticalPath ? ' (affects critical path)' : '';
    const cascadeNote = dependencyChain.cascadeRisk !== 'low' ? ` with ${dependencyChain.cascadeRisk} cascade risk` : '';
    
    let description = `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk ${reversibilityNote} action affecting ${services.length} primary service(s): ${services.join(', ')}`;
    
    if (dependencyChain.directDependencies.length > 0) {
      description += `. Potential cascade impact on ${dependencyChain.directDependencies.length} dependent service(s): ${dependencyChain.directDependencies.join(', ')}`;
    }
    
    description += `${criticalPathNote}${cascadeNote}. Total potential impact: ${totalImpact} services.`;
    
    return description;
  }

  /**
   * Detect comprehensive policy conflicts based on recommended action and context
   * Implements Requirements 4.2 - Enhanced policy conflict detection with business rules
   */
  private detectPolicyConflicts(recommendedAction: string, contextData: any): string[] {
    const conflicts: string[] = [];
    const action = recommendedAction.toLowerCase();
    const summary = contextData.incidentSummary.toLowerCase();
    const findings = contextData.agentFindings.join(' ').toLowerCase();

    // Production deployment conflicts
    if (action.includes('deploy') && (action.includes('production') || action.includes('prod'))) {
      conflicts.push('Production deployment requires change management approval');
      
      // Additional production deployment checks
      if (contextData.confidenceLevel < 0.8) {
        conflicts.push('Low confidence deployments to production require additional review');
      }
    }

    // Database modification conflicts
    if ((action.includes('database') || action.includes('db')) && 
        (action.includes('modify') || action.includes('update') || action.includes('alter') || 
         action.includes('delete') || action.includes('drop'))) {
      conflicts.push('Database modifications require DBA review');
      
      if (action.includes('production') || summary.includes('production')) {
        conflicts.push('Production database changes require maintenance window approval');
      }
    }

    // Security-related conflicts
    if (action.includes('security') || action.includes('auth') || action.includes('permission') ||
        action.includes('access') || action.includes('credential') || action.includes('certificate')) {
      conflicts.push('Security changes require security team approval');
      
      if (action.includes('disable') || action.includes('remove')) {
        conflicts.push('Security control removal requires CISO approval');
      }
    }

    // Service restart conflicts during business hours
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    
    if (isBusinessHours && isWeekday && 
        (action.includes('restart') || action.includes('reboot') || action.includes('stop'))) {
      conflicts.push('Service restarts during business hours require additional approval');
    }

    // High-impact service conflicts - only for destructive or major changes
    const criticalServices = ['payment', 'auth', 'database', 'api'];
    const affectedCriticalServices = criticalServices.filter(service => 
      action.includes(service) || summary.includes(service) || findings.includes(service)
    );
    
    if (affectedCriticalServices.length > 0 && 
        (action.includes('delete') || action.includes('drop') || action.includes('modify') || 
         action.includes('alter') || action.includes('change configuration'))) {
      conflicts.push(`Critical service changes (${affectedCriticalServices.join(', ')}) require senior approval`);
    }

    // Data-related conflicts
    if (action.includes('data') && (action.includes('delete') || action.includes('purge') || 
        action.includes('truncate') || action.includes('drop'))) {
      conflicts.push('Data deletion operations require data governance approval');
    }

    // Network and infrastructure conflicts
    if (action.includes('network') || action.includes('firewall') || action.includes('dns') ||
        action.includes('load balancer') || action.includes('proxy')) {
      conflicts.push('Network infrastructure changes require network team approval');
    }

    // Compliance-related conflicts - only for actual compliance systems
    if ((summary.includes('pci') || summary.includes('hipaa') || summary.includes('gdpr') ||
        findings.includes('compliance') || findings.includes('audit')) &&
        (action.includes('disable') || action.includes('modify') || action.includes('change'))) {
      conflicts.push('Actions affecting compliance-regulated systems require compliance review');
    }

    // Emergency vs. standard procedure conflicts
    if (contextData.confidenceLevel < 0.6 && !action.includes('rollback') && !action.includes('revert')) {
      conflicts.push('Low confidence actions require emergency response team consultation');
    }

    // Resource scaling conflicts
    if (action.includes('scale') || action.includes('capacity') || action.includes('resource')) {
      if (action.includes('up') || action.includes('increase')) {
        conflicts.push('Resource scaling up requires budget approval');
      }
      if (action.includes('down') || action.includes('decrease')) {
        conflicts.push('Resource scaling down requires performance impact assessment');
      }
    }

    // Third-party service conflicts
    const thirdPartyServices = ['aws', 'azure', 'gcp', 'stripe', 'paypal', 'twilio', 'sendgrid'];
    if (thirdPartyServices.some(service => action.includes(service) || summary.includes(service))) {
      conflicts.push('Third-party service changes require vendor relationship review');
    }

    // Configuration management conflicts
    if (action.includes('config') || action.includes('environment') || action.includes('variable')) {
      conflicts.push('Configuration changes require configuration management approval');
    }

    // Monitoring and alerting conflicts
    if (action.includes('monitoring') || action.includes('alert') || action.includes('metric')) {
      if (action.includes('disable') || action.includes('remove')) {
        conflicts.push('Disabling monitoring requires observability team approval');
      }
    }

    return conflicts;
  }

  /**
   * Assess action reversibility with detailed analysis
   * Implements comprehensive reversibility assessment for governance decisions
   */
  private assessReversibility(recommendedAction: string): boolean {
    const action = recommendedAction.toLowerCase();
    
    // Clearly irreversible actions
    const irreversibleKeywords = [
      'delete', 'drop', 'remove', 'destroy', 'purge', 'truncate',
      'terminate', 'decommission', 'uninstall'
    ];
    
    // Potentially irreversible actions (context-dependent)
    const potentiallyIrreversible = [
      'migrate', 'upgrade', 'downgrade', 'format', 'reset'
    ];
    
    // Check for clearly irreversible actions
    if (irreversibleKeywords.some(keyword => action.includes(keyword))) {
      return false;
    }
    
    // Check for potentially irreversible actions with additional context
    if (potentiallyIrreversible.some(keyword => action.includes(keyword))) {
      // These might be reversible depending on context
      if (action.includes('backup') || action.includes('snapshot') || action.includes('rollback')) {
        return true; // Has backup/rollback mechanism
      }
      return false; // Potentially irreversible without clear rollback
    }
    
    // Most other actions are considered reversible
    return true;
  }

  /**
   * Get pending governance requests
   */
  getPendingRequests(): GovernanceRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get completed governance requests
   */
  getCompletedRequests(): GovernanceRequest[] {
    return Array.from(this.completedRequests.values());
  }

  /**
   * Get governance request by ID
   */
  getRequest(requestId: string): GovernanceRequest | undefined {
    return this.pendingRequests.get(requestId) || this.completedRequests.get(requestId);
  }

  /**
   * Get governance request by workflow ID
   */
  getRequestByWorkflow(workflowId: string): GovernanceRequest | undefined {
    // Check pending requests first
    for (const request of this.pendingRequests.values()) {
      if (request.workflowId === workflowId) {
        return request;
      }
    }
    
    // Check completed requests
    for (const request of this.completedRequests.values()) {
      if (request.workflowId === workflowId) {
        return request;
      }
    }
    
    return undefined;
  }

  /**
   * Check if workflow has pending governance request
   * Implements GOVERNANCE_PENDING state blocking
   */
  hasPendingGovernanceRequest(workflowId: string): boolean {
    for (const request of this.pendingRequests.values()) {
      if (request.workflowId === workflowId && request.status === 'pending') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get governance statistics for monitoring
   */
  getGovernanceStats(): {
    pendingRequests: number;
    completedRequests: number;
    approvalRate: number;
    blockRate: number;
    averageDecisionTime: number;
  } {
    const completed = Array.from(this.completedRequests.values());
    const approved = completed.filter(r => r.status === 'approved' || r.status === 'approved_with_restrictions');
    const blocked = completed.filter(r => r.status === 'blocked');

    // Calculate average decision time
    const decisionTimes = completed
      .filter(r => r.decidedAt && r.createdAt)
      .map(r => new Date(r.decidedAt!).getTime() - new Date(r.createdAt).getTime());
    
    const averageDecisionTime = decisionTimes.length > 0 
      ? decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length 
      : 0;

    return {
      pendingRequests: this.pendingRequests.size,
      completedRequests: completed.length,
      approvalRate: completed.length > 0 ? approved.length / completed.length : 0,
      blockRate: completed.length > 0 ? blocked.length / completed.length : 0,
      averageDecisionTime: Math.round(averageDecisionTime / 1000) // Convert to seconds
    };
  }
}