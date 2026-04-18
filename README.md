# WHY MEAD

A mead-making community and resource hub, hosted on AWS with CloudFront, S3, Route53, and ACM.

## About

WHY MEAD is a brand celebrating the art of mead-making. The site features a bold bee-themed design with animated elements and a honeycomb background pattern, representing the craft and community around this ancient honey-based beverage.

## CloudFormation Linting

This project uses **[cfn-lint](https://github.com/aws-cloudformation/cfn-lint)** to validate the CloudFormation template.

### Installation

```bash
pip install cfnlint
# or
brew install cfn-lint
```

### Running the Linter

```bash
cfn-lint infra/cloudformation.yml
```

The template is validated against the AWS CloudFormation Resource Specification for `us-east-1`. All checks pass with no errors or warnings.

## Architecture

```
                    ┌─────────────┐
                    │   Route53   │
                    │  (DNS)      │
                    └──────┬──────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   CloudFront    │
                  │  (CDN + HTTPS)  │
                  └────────┬────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │       S3 Bucket        │
              │  (Static Hosting)      │
              └────────────────────────┘
```

### Infrastructure Components

| Component | Purpose |
|-----------|---------|
| **Amazon S3** | Static website hosting, stores `index.html` |
| **CloudFront** | CDN with HTTPS, global edge caching |
| **ACM** | SSL/TLS certificate for HTTPS (us-east-1) |
| **Route53** | DNS resolution for `whymead.io` |
| **Origin Access Identity** | Restricts S3 access to CloudFront only |
| **Security Headers Policy** | HSTS, X-Frame-Options, X-Content-Type-Options, etc. |

## Repository Structure

```
.
├── public/
│   ├── index.html          # Website source
│   └── bee.png             # Logo image
├── infra/
│   └── cloudformation.yml  # AWS CloudFormation template
├── cf_config.json          # CloudFront distribution config reference
├── cf_alias.json           # DNS alias record reference
├── README.md
└── .gitignore
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS account (Account: `309229301022`)
- Domain `whymead.io` registered and hosted in Route53

## Deploy Infrastructure

```bash
# Create the CloudFormation stack
aws cloudformation create-stack \
  --stack-name whymead-io \
  --template-body file://infra/cloudformation.yml \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=DomainName,ParameterValue=whymead.io \
    ParameterKey=HostedZoneId,ParameterValue=Z1047891W4VAY5MAROPO \
    ParameterKey=ACMCertificateArn,ParameterValue=arn:aws:acm:us-east-1:309229301022:certificate/a4a2a7cd-4c8f-4329-b95c-599ed7452098 \
    ParameterKey=WebsiteContentBucket,ParameterValue=why-meet-io

# Wait for stack creation to complete
aws cloudformation wait stack-create-complete \
  --stack-name whymead-io
```

## Deploy Website Content

```bash
# Upload the website to S3
aws s3 sync public/ s3://why-meet-io/ --delete

# Invalidate CloudFront cache after updates
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

## Update Website

1. Edit `public/index.html`
2. Push to the repository
3. Sync to S3:
   ```bash
   aws s3 sync public/ s3://why-meet-io/ --delete
   ```
4. Invalidate CloudFront cache:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <DISTRIBUTION_ID> \
     --paths "/*"
   ```

## Manage Infrastructure

```bash
# Update existing stack
aws cloudformation update-stack \
  --stack-name whymead-io \
  --template-body file://infra/cloudformation.yml \
  --capabilities CAPABILITY_IAM

# Delete stack (will also delete S3 bucket and its contents)
aws cloudformation delete-stack --stack-name whymead-io
```

## CloudFormation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `DomainName` | `whymead.io` | Primary domain name |
| `HostedZoneId` | `Z1047891W4VAY5MAROPO` | Route53 Hosted Zone ID |
| `ACMCertificateArn` | `arn:aws:acm:us-east-1:309229301022:certificate/a4a2a7cd-4c8f-4329-b95c-599ed7452098` | ACM Certificate ARN for HTTPS |
| `WebsiteContentBucket` | `why-meet-io` | S3 bucket name (must be globally unique) |

## CloudFront Distribution Details

- **Protocol**: HTTP → HTTPS redirect
- **SSL Method**: SNI-only
- **Minimum TLS**: 1.2
- **Price Class**: PriceClass_100 (US, Canada, Europe, Asia)
- **IPv6**: Enabled
- **HTTP/2**: Enabled

## Security Headers

The CloudFront distribution enforces the following security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-XSS-Protection: 1; mode=block`

## Notes

- The ACM certificate must be in `us-east-1` (required for CloudFront)
- S3 bucket name is globally unique and must be specified during stack creation
- The S3 bucket is set to `Private` access, with CloudFront OAI providing access
- The S3 website endpoint is separate from the CloudFront distribution
