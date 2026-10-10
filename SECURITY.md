# Coop-MS Security Policy

## Security Overview

Coop-MS is an enterprise cooperative-management and accounting software project.

Security is an important requirement because deployments may process staff information, financial transactions, accounting records and organisational documents.

## Reporting Vulnerabilities

Security vulnerabilities should be reported privately to the repository maintainer.

Do not publish credentials, exploit instructions, private documents or personal information in public GitHub issues.

Where enabled, use GitHub's private vulnerability reporting feature.

Reports should include the affected component, a description of the issue, its potential impact and safe reproduction steps.

## Supported Versions

Security maintenance is focused on the current development branch.

Older releases should not be assumed to receive security updates.

## Authentication and Authorisation

Deployments must enforce:

- Secure password hashing.
- Strong authentication secrets.
- Session expiration and revocation.
- Role-based access controls.
- Protected administrator registration.
- Server-side permission validation.
- Rate limiting for sensitive endpoints.

## Database Security

Microsoft SQL Server should be configured with encrypted connections, restricted network access and dedicated least-privilege application credentials.

Production data must not be committed to the repository.

## Financial Data Protection

Financial transactions require appropriate authorisation, database consistency, traceable approvals and audit records.

Sensitive financial information must be accessible only to authorised users.

## Document Security

Private documents must be protected by authenticated access controls.

File uploads must be validated and stored securely.

## Real-Time Communication

Socket.IO events must validate authentication and room membership before allowing access to conversations or message operations.

## Deployment Security

Production credentials must be stored outside source control.

Deployment environments must use appropriate HTTPS, database protection, logging, backups and recovery procedures.

## Security Testing

Security verification should include authentication testing, permission testing, input validation, dependency scanning, document-access testing and database security reviews.

## Responsible Disclosure

Security researchers should avoid disrupting production systems or accessing real member and financial information without explicit authorisation.

The maintainer will review privately submitted reports and coordinate appropriate remediation.

For implementation details, migrations, deployment acceptance checks and recovery procedures, see the [security rollout guide](docs/security-rollout.md).
