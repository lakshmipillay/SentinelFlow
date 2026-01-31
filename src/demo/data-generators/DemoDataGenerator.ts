/**
 * SentinelFlow Demo Data Generator
 * Generates realistic mocked data for incidents, agent outputs, and governance scenarios
 * Implements Requirements 9.2, 9.4 - Realistic data generation with proper skills attribution
 */

import { AgentOutput } from '../../types/workflow';
import { AgentName, AgentSkill } from '../../types/agent-skills';
import { 
  DemoScenario, 
  DemoIncident, 
  DemoGovernanceScenario,
  DemoAgentOutputTemplate 
} from '../types/demo-types';

export class DemoDataGenerator {
  private agentSkillsMap: Record<AgentName, AgentSkill[]> = {
    'sre-agent': ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
    'security-agent': ['Splunk SIEM', 'IAM Logs', 'CSPM'],
    'governance-agent': ['Policy Engine', 'Change Management', 'Risk Register']
  };

  private agentOutputTemplates: Record<AgentName, DemoAgentOutputTemplate> = {
    'sre-agent': {
      agentName: 'sre-agent',
      skillsToUse: ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
      findingsTemplate: {
        summaryPattern: 'Operational analysis indicates {primary_issue} with {confidence_level} confidence',
        evidencePatterns: [
          '{metric_name} shows {metric_value} {metric_unit}',
          'Log analysis reveals {log_pattern}',
          'Performance monitoring indicates {performance_issue}',
          'Infrastructure metrics show {infrastructure_status}'
        ],
        correlationPatterns: [
          'Correlation with {related_event} at {timestamp}',
          'Pattern matches {historical_incident}',
          'Dependency analysis shows {dependency_impact}'
        ],
        recommendationPatterns: [
          'Recommend monitoring {metric} for {duration}',
          'Suggest analyzing {resource} utilization',
          'Propose reviewing {configuration} settings'
        ]
      },
      confidenceRange: { min: 0.7, max: 0.95 },
      processingTimeRange: { minMs: 1500, maxMs: 3000 }
    },
    'security-agent': {
      agentName: 'security-agent',
      skillsToUse: ['Splunk SIEM', 'IAM Logs', 'CSPM'],
      findingsTemplate: {
        summaryPattern: 'Security analysis shows {security_status} with {threat_level} threat level',
        evidencePatterns: [
          'SIEM analysis reveals {security_event}',
          'Access logs show {access_pattern}',
          'Compliance scan indicates {compliance_status}',
          'Threat intelligence suggests {threat_indicator}'
        ],
        correlationPatterns: [
          'Security event correlates with {incident_type}',
          'Access pattern matches {known_threat}',
          'Timeline aligns with {security_event}'
        ],
        recommendationPatterns: [
          'Recommend reviewing {security_policy}',
          'Suggest monitoring {access_pattern}',
          'Propose analyzing {security_logs}'
        ]
      },
      confidenceRange: { min: 0.6, max: 0.9 },
      processingTimeRange: { minMs: 2000, maxMs: 4000 }
    },
    'governance-agent': {
      agentName: 'governance-agent',
      skillsToUse: ['Policy Engine', 'Change Management', 'Risk Register'],
      findingsTemplate: {
        summaryPattern: 'Governance analysis indicates {compliance_status} with {risk_level} risk',
        evidencePatterns: [
          'Policy engine shows {policy_status}',
          'Change management records indicate {change_status}',
          'Risk register shows {risk_assessment}',
          'Compliance framework requires {compliance_action}'
        ],
        correlationPatterns: [
          'Policy violation correlates with {incident_cause}',
          'Change timing aligns with {incident_start}',
          'Risk assessment matches {current_situation}'
        ],
        recommendationPatterns: [
          'Recommend reviewing {policy_reference}',
          'Suggest following {approval_process}',
          'Propose implementing {risk_mitigation} strategy'
        ]
      },
      confidenceRange: { min: 0.8, max: 0.95 },
      processingTimeRange: { minMs: 1000, maxMs: 2500 }
    }
  };

  /**
   * Generate realistic incident data based on scenario
   * Implements Requirements 9.2 - Mocked data generation
   */
  generateIncident(scenario: DemoScenario): DemoIncident {
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // Generate realistic metrics based on scenario severity
    const baseMetrics = scenario.incidentTemplate.initialMetrics;
    const metrics = {
      cpu: this.addVariation(baseMetrics.cpu, 5),
      memory: this.addVariation(baseMetrics.memory, 8),
      errorRate: this.addVariation(baseMetrics.errorRate, 2),
      responseTime: this.addVariation(baseMetrics.responseTime, 1000),
      throughput: this.addVariation(baseMetrics.throughput, 10)
    };

    // Generate realistic logs based on scenario type
    const logs = this.generateIncidentLogs(scenario, timestamp);

    // Generate alert information
    const alert = this.generateAlert(scenario, metrics);

    return {
      incidentId,
      type: scenario.type,
      description: this.generateIncidentDescription(scenario),
      severity: scenario.incidentTemplate.severity,
      affectedServices: [...scenario.incidentTemplate.affectedServices],
      timestamp,
      metrics,
      logs,
      alert
    };
  }

  /**
   * Generate realistic agent output based on scenario and agent type
   * Implements Requirements 9.4 - Realistic agent analysis with skills attribution
   */
  generateAgentOutput(
    agentName: AgentName, 
    incident: DemoIncident, 
    scenario: DemoScenario
  ): AgentOutput {
    const template = this.agentOutputTemplates[agentName];
    const expectedFindings = scenario.expectedAnalysis[`${agentName.replace('-agent', '')}Findings` as keyof typeof scenario.expectedAnalysis] as string[];

    // Select skills to use (subset of available skills)
    const skillsUsed = this.selectSkillsForAnalysis(template.skillsToUse, incident.severity);

    // Generate confidence level within agent's range
    const confidenceLevel = this.generateConfidenceLevel(
      template.confidenceRange.min,
      template.confidenceRange.max,
      incident.severity
    );

    // Generate processing time
    const processingTimeMs = Math.floor(
      Math.random() * (template.processingTimeRange.maxMs - template.processingTimeRange.minMs) +
      template.processingTimeRange.minMs
    );

    // Generate findings based on scenario and template
    const findings = this.generateFindings(template, incident, expectedFindings, scenario);

    // Generate detailed skills usage metadata
    const skillUsageDetails = this.generateSkillUsageDetails(skillsUsed, processingTimeMs);

    // Generate metadata with enhanced skills attribution (matching AgentSkillsMetadata interface)
    const metadata = {
      processingTimeMs,
      dataSourcesAccessed: this.generateDataSources(agentName, skillsUsed),
      skillsMetadata: {
        skillsUsed: skillsUsed,
        skillUsageDetails: skillUsageDetails.map(detail => ({
          skill: detail.skill,
          usedAt: detail.usedAt,
          duration: detail.duration,
          dataSourcesAccessed: detail.dataSourcesAccessed
        })),
        totalSkillsAvailable: template.skillsToUse.length,
        skillsUtilizationRate: skillsUsed.length / template.skillsToUse.length
      },
      progressiveDisclosure: {
        totalSteps: skillsUsed.length,
        stepsCompleted: skillsUsed.length,
        averageStepDuration: processingTimeMs / skillsUsed.length,
        skillProgression: this.generateSkillProgression(skillsUsed, processingTimeMs)
      }
    };

    // Generate validation flags
    const validation = {
      skillsValid: this.validateSkillsForAgent(agentName, skillsUsed),
      confidenceLevelValid: confidenceLevel >= 0 && confidenceLevel <= 1,
      schemaCompliant: true
    };

    return {
      agentName,
      skillsUsed,
      findings,
      confidenceLevel,
      timestamp: new Date().toISOString(),
      metadata,
      validation
    };
  }

  /**
   * Generate detailed skill usage information for audit and attribution
   */
  private generateSkillUsageDetails(skillsUsed: AgentSkill[], totalProcessingTime: number): Array<{
    skill: AgentSkill;
    usedAt: string;
    duration: number;
    dataSourcesAccessed: string[];
    findingsContributed: number;
    confidenceContribution: number;
  }> {
    const now = new Date();
    const details = [];
    
    for (let i = 0; i < skillsUsed.length; i++) {
      const skill = skillsUsed[i];
      const skillStartTime = new Date(now.getTime() - totalProcessingTime + (i * (totalProcessingTime / skillsUsed.length)));
      const duration = Math.floor(totalProcessingTime / skillsUsed.length) + Math.floor(Math.random() * 1000);
      
      details.push({
        skill,
        usedAt: skillStartTime.toISOString(),
        duration,
        dataSourcesAccessed: this.getDataSourcesForSkill(skill),
        findingsContributed: Math.floor(Math.random() * 3) + 1, // 1-3 findings per skill
        confidenceContribution: Math.random() * 0.3 + 0.1 // 0.1-0.4 confidence contribution
      });
    }
    
    return details;
  }

  /**
   * Generate skill progression for progressive disclosure
   */
  private generateSkillProgression(skillsUsed: AgentSkill[], totalProcessingTime: number): Array<{
    step: number;
    skill: AgentSkill;
    startTime: number;
    duration: number;
    partialFindings: string[];
    cumulativeConfidence: number;
  }> {
    const progression = [];
    const stepDuration = totalProcessingTime / skillsUsed.length;
    
    for (let i = 0; i < skillsUsed.length; i++) {
      const skill = skillsUsed[i];
      progression.push({
        step: i + 1,
        skill,
        startTime: i * stepDuration,
        duration: stepDuration + Math.floor(Math.random() * 500), // Add some variation
        partialFindings: this.generatePartialFindingsForSkill(skill),
        cumulativeConfidence: Math.min(0.95, 0.2 + (i + 1) * 0.2) // Gradually build confidence
      });
    }
    
    return progression;
  }

  /**
   * Calculate skill effectiveness based on usage and confidence
   */
  private calculateSkillEffectiveness(skillsUsed: AgentSkill[], confidenceLevel: number): Record<string, number> {
    const effectiveness: Record<string, number> = {};
    
    skillsUsed.forEach((skill, index) => {
      // Skills used earlier contribute more to effectiveness
      const positionWeight = (skillsUsed.length - index) / skillsUsed.length;
      const baseEffectiveness = confidenceLevel * positionWeight;
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      
      effectiveness[skill] = Math.max(0.1, Math.min(1.0, baseEffectiveness + variation));
    });
    
    return effectiveness;
  }

  /**
   * Generate partial findings for a specific skill (used in progressive disclosure)
   */
  private generatePartialFindingsForSkill(skill: AgentSkill): string[] {
    const findingsMap: Record<string, string[]> = {
      'Datadog': [
        'CPU utilization spike detected at 14:32 UTC',
        'Memory usage trending upward over last 15 minutes',
        'Application response time degradation observed'
      ],
      'CloudWatch': [
        'Database connection errors increasing',
        'Lambda function timeout rate elevated',
        'ELB health check failures detected'
      ],
      'Prometheus': [
        'Alert threshold breached for error rate',
        'Service availability declining',
        'Request latency percentiles elevated'
      ],
      'OpenTelemetry': [
        'Distributed tracing shows bottlenecks in database layer',
        'Error rate spike in user authentication service',
        'Request correlation shows cascade failure pattern'
      ],
      'Splunk SIEM': [
        'Unusual authentication patterns detected',
        'Multiple failed login attempts from suspicious IPs',
        'Privilege escalation attempts identified'
      ],
      'IAM Logs': [
        'Access from unusual geographic locations',
        'Service account usage outside normal hours',
        'Permission changes detected in critical roles'
      ],
      'CSPM': [
        'Security group configuration drift detected',
        'Encryption policy violations found',
        'Compliance posture degradation identified'
      ],
      'Policy Engine': [
        'Change approval process bypassed',
        'Policy violation in production deployment',
        'Risk threshold exceeded for proposed action'
      ],
      'Change Management': [
        'Emergency deployment detected without proper approval',
        'Standard workflow not followed for critical change',
        'Change rollback plan not documented'
      ],
      'Risk Register': [
        'Risk level elevated beyond acceptable threshold',
        'Mitigation controls insufficient for current threat',
        'Business impact assessment indicates high severity'
      ]
    };

    return findingsMap[skill] || [`Analysis in progress using ${skill}`];
  }

  /**
   * Get data sources for a specific skill
   */
  private getDataSourcesForSkill(skill: AgentSkill): string[] {
    const dataSourceMap: Record<string, string[]> = {
      'Datadog': ['datadog-metrics-api', 'datadog-logs-api', 'datadog-traces-api'],
      'CloudWatch': ['cloudwatch-metrics', 'cloudwatch-logs', 'cloudwatch-alarms'],
      'Prometheus': ['prometheus-metrics', 'prometheus-alerts', 'prometheus-rules'],
      'OpenTelemetry': ['otel-traces', 'otel-metrics', 'otel-logs'],
      'Splunk SIEM': ['splunk-security-events', 'splunk-threat-intel', 'splunk-user-behavior'],
      'IAM Logs': ['iam-access-logs', 'iam-policy-logs', 'iam-audit-trail'],
      'CSPM': ['cspm-compliance-scan', 'cspm-policy-violations', 'cspm-security-posture'],
      'Policy Engine': ['policy-definitions', 'policy-violations', 'policy-exceptions'],
      'Change Management': ['change-records', 'approval-history', 'deployment-logs'],
      'Risk Register': ['risk-assessments', 'risk-mitigations', 'risk-monitoring']
    };

    return dataSourceMap[skill] || [`${skill.toLowerCase().replace(' ', '-')}-api`];
  }

  /**
   * Generate governance scenario for decision making with human approval requirements
   * Implements Requirements 9.5 - Realistic governance scenarios with human-in-the-loop
   */
  generateGovernanceScenario(
    incident: DemoIncident,
    scenario: DemoScenario,
    forcedDecision?: 'approve' | 'approve_with_restrictions' | 'block'
  ): DemoGovernanceScenario {
    const governanceTemplate = scenario.governanceScenario;

    // Generate blast radius assessment
    const blastRadiusAssessment = {
      affectedServices: [...governanceTemplate.blastRadiusServices],
      dependencyChain: this.generateDependencyChain(governanceTemplate.blastRadiusServices),
      riskLevel: governanceTemplate.defaultRiskLevel,
      reversible: this.assessReversibility(scenario.type),
      estimatedImpact: {
        usersAffected: this.estimateUsersAffected(incident.severity, governanceTemplate.blastRadiusServices.length),
        revenueImpact: this.estimateRevenueImpact(incident.severity),
        recoveryTime: this.estimateRecoveryTime(scenario.complexity)
      }
    };

    // Generate decision factors
    const decisionFactors = {
      businessImpact: this.assessBusinessImpact(incident.severity),
      technicalRisk: this.assessTechnicalRisk(scenario.complexity),
      complianceRisk: this.assessComplianceRisk(scenario.type),
      timeConstraints: this.assessTimeConstraints(incident.severity)
    };

    // Determine recommended decision
    const recommendedDecision = forcedDecision || this.determineRecommendedDecision(
      decisionFactors,
      governanceTemplate.defaultRiskLevel
    );

    return {
      blastRadiusAssessment,
      policyConflicts: [...governanceTemplate.policyConflicts],
      riskLevel: governanceTemplate.defaultRiskLevel,
      recommendedDecision,
      decisionFactors
    };
  }

  /**
   * Generate governance scenario that specifically requires human approval
   * Implements Requirements 9.5 - Human approval scenarios
   */
  generateHumanApprovalScenario(
    incident: DemoIncident,
    scenario: DemoScenario,
    approvalType: 'security_review' | 'executive_approval' | 'compliance_check' | 'risk_assessment'
  ): DemoGovernanceScenario & {
    humanApprovalRequired: true;
    approvalType: string;
    approvalReason: string;
    escalationLevel: string;
    timeoutMinutes: number;
    requiredApprovers: string[];
  } {
    const baseScenario = this.generateGovernanceScenario(incident, scenario);
    
    // Enhance with human approval requirements
    const approvalDetails = this.generateApprovalDetails(approvalType, incident, scenario);
    
    return {
      ...baseScenario,
      humanApprovalRequired: true,
      approvalType,
      approvalReason: approvalDetails.reason,
      escalationLevel: approvalDetails.escalationLevel,
      timeoutMinutes: approvalDetails.timeoutMinutes,
      requiredApprovers: approvalDetails.requiredApprovers,
      // Override risk level to ensure human approval is triggered
      riskLevel: approvalDetails.minimumRiskLevel as 'low' | 'medium' | 'high' | 'critical'
    };
  }

  /**
   * Generate approval details for different approval types
   */
  private generateApprovalDetails(
    approvalType: string,
    incident: DemoIncident,
    scenario: DemoScenario
  ): {
    reason: string;
    escalationLevel: string;
    timeoutMinutes: number;
    requiredApprovers: string[];
    minimumRiskLevel: string;
  } {
    const approvalMap = {
      'security_review': {
        reason: 'Security incident requires CISO approval due to potential data exposure',
        escalationLevel: 'C-Level Executive',
        timeoutMinutes: 15,
        requiredApprovers: ['CISO', 'Security Team Lead', 'Incident Commander'],
        minimumRiskLevel: 'high'
      },
      'executive_approval': {
        reason: 'High business impact requires executive approval due to revenue implications',
        escalationLevel: 'C-Level Executive',
        timeoutMinutes: 30,
        requiredApprovers: ['CTO', 'VP Engineering', 'Business Continuity Manager'],
        minimumRiskLevel: 'critical'
      },
      'compliance_check': {
        reason: 'Regulatory compliance requirements mandate legal team review',
        escalationLevel: 'Director Level',
        timeoutMinutes: 60,
        requiredApprovers: ['Compliance Officer', 'Legal Counsel', 'Risk Manager'],
        minimumRiskLevel: 'medium'
      },
      'risk_assessment': {
        reason: 'Risk threshold exceeded, requires risk committee approval',
        escalationLevel: 'Manager Level',
        timeoutMinutes: 45,
        requiredApprovers: ['Risk Manager', 'Operations Manager', 'Technical Lead'],
        minimumRiskLevel: 'medium'
      }
    };

    const details = approvalMap[approvalType as keyof typeof approvalMap];
    if (!details) {
      throw new Error(`Unknown approval type: ${approvalType}`);
    }

    // Adjust timeout based on incident severity
    const severityMultiplier = {
      'critical': 0.5,  // Half the time for critical
      'high': 0.75,     // 75% of time for high
      'medium': 1.0,    // Full time for medium
      'low': 1.5        // 150% of time for low
    }[incident.severity] || 1.0;

    return {
      ...details,
      timeoutMinutes: Math.floor(details.timeoutMinutes * severityMultiplier)
    };
  }

  /**
   * Generate realistic incident logs
   */
  private generateIncidentLogs(scenario: DemoScenario, baseTimestamp: string): Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'critical';
    service: string;
    message: string;
    metadata?: Record<string, any>;
  }> {
    const logs: Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error' | 'critical';
      service: string;
      message: string;
      metadata?: Record<string, any>;
    }> = [];
    const baseTime = new Date(baseTimestamp).getTime();
    const services = scenario.incidentTemplate.affectedServices;

    // Generate logs for each timeline event
    scenario.incidentTemplate.timelineEvents.forEach((event, index) => {
      const eventTime = baseTime + (index * 2 * 60 * 1000); // 2 minutes apart
      
      services.forEach(service => {
        logs.push({
          timestamp: new Date(eventTime).toISOString(),
          level: this.getLogLevelForSeverity(scenario.incidentTemplate.severity),
          service,
          message: this.generateLogMessage(scenario.type, event.event, service),
          metadata: {
            eventId: event.event.toLowerCase().replace(/\s+/g, '_'),
            correlationId: `corr-${index}-${service}`,
            traceId: `trace-${Math.random().toString(36).substr(2, 8)}`
          }
        });
      });
    });

    return logs;
  }

  /**
   * Generate alert information
   */
  private generateAlert(scenario: DemoScenario, metrics: any): {
    alertId: string;
    source: string;
    rule: string;
    threshold: number;
    currentValue: number;
    duration: string;
  } {
    const alertId = `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Select primary metric for alert
    const primaryMetric = this.selectPrimaryMetricForScenario(scenario.type);
    const threshold = this.getThresholdForMetric(primaryMetric, scenario.incidentTemplate.severity);
    const currentValue = metrics[primaryMetric] || 0;

    return {
      alertId,
      source: this.getAlertSourceForScenario(scenario.type),
      rule: `${primaryMetric}_threshold_exceeded`,
      threshold,
      currentValue,
      duration: this.generateAlertDuration(scenario.incidentTemplate.severity)
    };
  }

  /**
   * Generate findings based on template and scenario
   */
  private generateFindings(
    template: DemoAgentOutputTemplate,
    incident: DemoIncident,
    expectedFindings: string[],
    scenario: DemoScenario
  ): {
    summary: string;
    evidence: string[];
    correlations: string[];
    recommendations?: string[];
  } {
    // Use expected findings from scenario as base
    const summary = expectedFindings[0] || template.findingsTemplate.summaryPattern
      .replace('{primary_issue}', incident.type)
      .replace('{confidence_level}', 'high');

    const evidence = expectedFindings.slice(1, 4).length > 0 
      ? expectedFindings.slice(1, 4)
      : this.generateEvidenceFromTemplate(template, incident);

    const correlations = scenario.expectedAnalysis.correlationPoints?.slice(0, 2) || [
      'Recent system changes detected',
      'Pattern matches historical incidents'
    ];

    const recommendations = template.findingsTemplate.recommendationPatterns
      ? this.generateRecommendationsFromTemplate(template, incident)
      : undefined;

    return {
      summary,
      evidence,
      correlations,
      recommendations
    };
  }

  /**
   * Select skills for analysis based on incident severity
   */
  private selectSkillsForAnalysis(availableSkills: string[], severity: string): AgentSkill[] {
    const skillCount = severity === 'critical' ? availableSkills.length : 
                      severity === 'high' ? Math.max(2, availableSkills.length - 1) :
                      severity === 'medium' ? Math.max(1, availableSkills.length - 2) :
                      1;

    return availableSkills.slice(0, skillCount) as AgentSkill[];
  }

  /**
   * Generate confidence level based on agent capabilities and incident severity
   */
  private generateConfidenceLevel(min: number, max: number, severity: string): number {
    const baseConfidence = Math.random() * (max - min) + min;
    
    // Adjust confidence based on severity (higher severity = more data = higher confidence)
    const severityMultiplier = {
      'critical': 1.0,
      'high': 0.95,
      'medium': 0.9,
      'low': 0.85
    }[severity] || 0.8;

    return Math.min(1.0, baseConfidence * severityMultiplier);
  }

  /**
   * Generate data sources accessed by agent
   */
  private generateDataSources(agentName: AgentName, skillsUsed: AgentSkill[]): string[] {
    const dataSourceMap: Record<string, string[]> = {
      'Datadog': ['datadog-metrics', 'datadog-logs', 'datadog-traces'],
      'CloudWatch': ['cloudwatch-metrics', 'cloudwatch-logs', 'cloudwatch-alarms'],
      'Prometheus': ['prometheus-metrics', 'prometheus-alerts'],
      'OpenTelemetry': ['otel-traces', 'otel-metrics', 'otel-logs'],
      'Splunk SIEM': ['splunk-security-events', 'splunk-threat-intel'],
      'IAM Logs': ['iam-access-logs', 'iam-policy-logs'],
      'CSPM': ['cspm-compliance-scan', 'cspm-policy-violations'],
      'Policy Engine': ['policy-definitions', 'policy-violations'],
      'Change Management': ['change-records', 'approval-history'],
      'Risk Register': ['risk-assessments', 'risk-mitigations']
    };

    const dataSources: string[] = [];
    skillsUsed.forEach(skill => {
      const sources = dataSourceMap[skill] || [`${skill.toLowerCase()}-data`];
      dataSources.push(...sources);
    });

    return [...new Set(dataSources)];
  }

  /**
   * Calculate analysis depth based on confidence and skills used
   */
  private calculateAnalysisDepth(confidenceLevel: number, skillsCount: number): 'shallow' | 'moderate' | 'deep' {
    const depthScore = (confidenceLevel * 0.7) + (skillsCount / 4 * 0.3);
    
    if (depthScore >= 0.8) return 'deep';
    if (depthScore >= 0.6) return 'moderate';
    return 'shallow';
  }

  /**
   * Validate skills are appropriate for agent
   */
  private validateSkillsForAgent(agentName: AgentName, skillsUsed: AgentSkill[]): boolean {
    const validSkills = this.agentSkillsMap[agentName];
    return skillsUsed.every(skill => validSkills.includes(skill));
  }

  /**
   * Add realistic variation to metrics
   */
  private addVariation(baseValue: number, variationPercent: number): number {
    const variation = baseValue * (variationPercent / 100);
    const randomVariation = (Math.random() - 0.5) * 2 * variation;
    return Math.max(0, Math.round((baseValue + randomVariation) * 100) / 100);
  }

  /**
   * Generate incident description with realistic details
   */
  private generateIncidentDescription(scenario: DemoScenario): string {
    const templates = {
      'database-outage': `Database connection pool exhaustion detected on primary database server. ${scenario.incidentTemplate.affectedServices.length} services experiencing connectivity issues.`,
      'api-failure': `API Gateway rate limiting cascade failure affecting ${scenario.incidentTemplate.affectedServices.length} downstream services with elevated error rates.`,
      'security-incident': `Suspicious authentication patterns detected with potential unauthorized access attempts across ${scenario.incidentTemplate.affectedServices.length} security-sensitive services.`,
      'infrastructure-issue': `Container orchestration platform experiencing resource exhaustion with pod scheduling failures across ${scenario.incidentTemplate.affectedServices.length} services.`,
      'deployment-problem': `Recent deployment v2.1.3 causing application errors in ${scenario.incidentTemplate.affectedServices.length} services requiring immediate attention.`
    };

    return templates[scenario.type] || `Incident affecting ${scenario.incidentTemplate.affectedServices.length} services with ${scenario.incidentTemplate.severity} severity.`;
  }

  // Additional helper methods for realistic data generation...
  
  private getLogLevelForSeverity(severity: string): 'info' | 'warn' | 'error' | 'critical' {
    const levelMap = {
      'critical': 'critical' as const,
      'high': 'error' as const,
      'medium': 'warn' as const,
      'low': 'info' as const
    };
    return levelMap[severity as keyof typeof levelMap] || 'warn';
  }

  private generateLogMessage(scenarioType: string, event: string, service: string): string {
    return `[${service}] ${event} - ${scenarioType} incident detected`;
  }

  private selectPrimaryMetricForScenario(scenarioType: string): string {
    const metricMap = {
      'database-outage': 'responseTime',
      'api-failure': 'errorRate',
      'security-incident': 'errorRate',
      'infrastructure-issue': 'cpu',
      'deployment-problem': 'errorRate'
    };
    return metricMap[scenarioType as keyof typeof metricMap] || 'errorRate';
  }

  private getThresholdForMetric(metric: string, severity: string): number {
    const thresholds = {
      'cpu': { critical: 90, high: 80, medium: 70, low: 60 },
      'memory': { critical: 95, high: 85, medium: 75, low: 65 },
      'errorRate': { critical: 20, high: 15, medium: 10, low: 5 },
      'responseTime': { critical: 10000, high: 7500, medium: 5000, low: 2500 }
    };
    
    const metricThresholds = thresholds[metric as keyof typeof thresholds] || thresholds.errorRate;
    return metricThresholds[severity as keyof typeof metricThresholds] || 10;
  }

  private getAlertSourceForScenario(scenarioType: string): string {
    const sourceMap = {
      'database-outage': 'Database Monitoring',
      'api-failure': 'API Gateway',
      'security-incident': 'Security Operations Center',
      'infrastructure-issue': 'Infrastructure Monitoring',
      'deployment-problem': 'Deployment Pipeline'
    };
    return sourceMap[scenarioType as keyof typeof sourceMap] || 'System Monitoring';
  }

  private generateAlertDuration(severity: string): string {
    const durations = {
      'critical': '15m',
      'high': '10m',
      'medium': '5m',
      'low': '2m'
    };
    return durations[severity as keyof typeof durations] || '5m';
  }

  private generateEvidenceFromTemplate(template: DemoAgentOutputTemplate, incident: DemoIncident): string[] {
    return template.findingsTemplate.evidencePatterns.slice(0, 3).map(pattern =>
      pattern.replace('{metric_name}', 'CPU utilization')
              .replace('{metric_value}', '85')
              .replace('{metric_unit}', '%')
              .replace('{log_pattern}', 'connection timeout errors')
              .replace('{performance_issue}', 'response time degradation')
              .replace('{infrastructure_status}', 'resource exhaustion')
    );
  }

  private generateRecommendationsFromTemplate(template: DemoAgentOutputTemplate, incident: DemoIncident): string[] {
    if (!template.findingsTemplate.recommendationPatterns) return [];
    
    return template.findingsTemplate.recommendationPatterns.slice(0, 2).map(pattern =>
      pattern.replace('{action_type}', 'monitor')
              .replace('{issue}', incident.type)
              .replace('{metric}', 'connection pool')
              .replace('{duration}', '15 minutes')
              .replace('{resource}', 'database connections')
              .replace('{amount}', '50%')
              .replace('{security_action}', 'review')
              .replace('{security_concern}', 'access patterns')
              .replace('{security_policy}', 'authentication policy')
              .replace('{access_control}', 'access monitoring')
              .replace('{governance_action}', 'review')
              .replace('{policy_reference}', 'change management policy')
              .replace('{approval_process}', 'standard approval workflow')
              .replace('{proposed_action}', 'remediation plan')
              .replace('{risk_mitigation}', 'monitoring')
              .replace('{configuration}', 'system configuration')
    );
  }

  private generateDependencyChain(services: string[]): Array<{
    service: string;
    dependencies: string[];
    criticalPath: boolean;
  }> {
    return services.map((service, index) => ({
      service,
      dependencies: services.slice(0, index),
      criticalPath: index < 2 // First two services are on critical path
    }));
  }

  private assessReversibility(scenarioType: string): boolean {
    const reversibilityMap = {
      'database-outage': true,
      'api-failure': true,
      'security-incident': false, // Security actions often irreversible
      'infrastructure-issue': true,
      'deployment-problem': true
    };
    return reversibilityMap[scenarioType as keyof typeof reversibilityMap] ?? true;
  }

  private estimateUsersAffected(severity: string, serviceCount: number): number {
    const baseUsers = {
      'critical': 10000,
      'high': 5000,
      'medium': 1000,
      'low': 100
    }[severity] || 1000;
    
    return baseUsers * serviceCount;
  }

  private estimateRevenueImpact(severity: string): number {
    const impacts = {
      'critical': 50000,
      'high': 25000,
      'medium': 10000,
      'low': 1000
    };
    return impacts[severity as keyof typeof impacts] || 10000;
  }

  private estimateRecoveryTime(complexity: string): string {
    const times = {
      'complex': '2-4 hours',
      'moderate': '1-2 hours',
      'simple': '30-60 minutes'
    };
    return times[complexity as keyof typeof times] || '1-2 hours';
  }

  private assessBusinessImpact(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    return severity as 'low' | 'medium' | 'high' | 'critical';
  }

  private assessTechnicalRisk(complexity: string): 'low' | 'medium' | 'high' | 'critical' {
    const riskMap = {
      'simple': 'low' as const,
      'moderate': 'medium' as const,
      'complex': 'high' as const
    };
    return riskMap[complexity as keyof typeof riskMap] || 'medium';
  }

  private assessComplianceRisk(scenarioType: string): 'low' | 'medium' | 'high' | 'critical' {
    const riskMap = {
      'security-incident': 'critical' as const,
      'database-outage': 'medium' as const,
      'api-failure': 'medium' as const,
      'infrastructure-issue': 'low' as const,
      'deployment-problem': 'low' as const
    };
    return riskMap[scenarioType as keyof typeof riskMap] || 'low';
  }

  private assessTimeConstraints(severity: string): 'flexible' | 'moderate' | 'urgent' | 'critical' {
    const constraintMap = {
      'critical': 'critical' as const,
      'high': 'urgent' as const,
      'medium': 'moderate' as const,
      'low': 'flexible' as const
    };
    return constraintMap[severity as keyof typeof constraintMap] || 'moderate';
  }

  private determineRecommendedDecision(
    factors: any,
    defaultRiskLevel: string
  ): 'approve' | 'approve_with_restrictions' | 'block' {
    // Simple decision logic based on risk factors
    const riskScore = this.calculateRiskScore(factors);
    
    if (riskScore >= 0.8) return 'block';
    if (riskScore >= 0.6) return 'approve_with_restrictions';
    return 'approve';
  }

  private calculateRiskScore(factors: any): number {
    const weights = {
      businessImpact: 0.3,
      technicalRisk: 0.3,
      complianceRisk: 0.3,
      timeConstraints: 0.1
    };

    const scores = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0,
      'flexible': 0.1,
      'moderate': 0.3,
      'urgent': 0.7
    };

    let totalScore = 0;
    Object.entries(factors).forEach(([factor, value]) => {
      const weight = weights[factor as keyof typeof weights] || 0;
      const score = scores[value as keyof typeof scores] || 0.5;
      totalScore += weight * score;
    });

    return totalScore;
  }
}