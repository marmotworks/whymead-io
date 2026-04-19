# WHY MEAD

A mead-making community and resource hub, hosted on AWS with CloudFront, S3, Route53, and ACM.

## About

WHY MEAD is a brand celebrating the art of mead-making. The site features a bold bee-themed design with animated elements and a honeycomb background pattern, representing the craft and community around this ancient honey-based beverage.

## CloudFormation Linting

This project uses **[cfn-lint](https://github.com/aws-cloudformation/cfn-lint)** to validate the CloudFormation template.

### Installation

```bash
pip install cfn-lint
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
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌────────────────────┐    ┌──────────────────┐
    │       S3 Bucket     │    │   API Gateway     │
    │  (Static Hosting)   │    │  (Lambda Proxy)   │
    └────────────────────┘    └────────┬─────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │    Lambda Functions     │
                          │  (Flavor Request)       │
                          └───────────┬────────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │  DynamoDB     │  │    SNS       │  │  CloudWatch   │
            │ (Requests DB) │  │ (Notifications)│ │   Logs       │
            └──────────────┘  └──────────────┘  └──────────────┘
```

### Infrastructure Components

| Component | Purpose |
|-----------|---------|
| **Amazon S3** | Static website hosting, stores `index.html` and `limited-edition.html` |
| **CloudFront** | CDN with HTTPS, global edge caching |
| **ACM** | SSL/TLS certificate for HTTPS (us-east-1) |
| **Route53** | DNS resolution for `whymead.io` |
| **Origin Access Identity** | Restricts S3 access to CloudFront only |
| **Security Headers Policy** | HSTS, X-Frame-Options, X-Content-Type-Options, etc. |
| **API Gateway** | REST API for flavor request submissions |
| **Lambda** | Handles flavor requests (DynamoDB) and daily notifications (SNS) |
| **DynamoDB** | Stores flavor request submissions with TTL cleanup |
| **SNS** | Email notifications for daily flavor request summaries |
| **EventBridge** | Triggers daily notification Lambda |

## Repository Structure

```
.
├── public/
│   ├── index.html              # Main website
│   ├── limited-edition.html    # Limited edition meads + flavor request form
│   └── bee.png                 # Logo image
├── infra/
│   ├── cloudformation.yml      # AWS CloudFormation template
│   ├── lambda/
│   │   ├── flavor_request_handler.py   # API Lambda - saves requests to DynamoDB
│   │   └── daily_notification.py       # Scheduled Lambda - daily email summary
│   └── lambda-functions.zip      # Packaged Lambda code
├── cf_config.json              # CloudFront distribution config reference
├── cf_alias.json               # DNS alias record reference
├── README.md
└── .gitignore
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS account (Account: `309229301022`)
- Domain `whymead.io` registered and hosted in Route53
- `cfn-lint` installed for template validation

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
    ParameterKey=WebsiteContentBucket,ParameterValue=why-meet-io \
    ParameterKey=NotificationEmail,ParameterValue=mike@beef.tips
```

### Deploy Lambda Functions

```bash
# Package Lambda code (creates zip and uploads to S3)
cd infra/lambda
zip -r ../lambda-functions.zip .
aws s3 cp ../lambda-functions.zip s3://whymead-io-deployments/lambda-functions.zip
cd ../..
```

### Update Infrastructure

```bash
# Update the CloudFormation stack
aws cloudformation update-stack \
  --stack-name whymead-io \
  --template-body file://infra/cloudformation.yml \
  --capabilities CAPABILITY_IAM

# Wait for stack update to complete
aws cloudformation wait stack-update-complete \
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

1. Edit files in `public/`
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

## Update Lambda Functions

1. Edit files in `infra/lambda/`
2. Repackage and upload:
   ```bash
   cd infra/lambda
   zip -r ../lambda-functions.zip .
   aws s3 cp ../lambda-functions.zip s3://whymead-io-deployments/lambda-functions.zip
   cd ../..
   ```
3. Update CloudFormation stack (see "Update Infrastructure" above)

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
| `NotificationEmail` | `mike@beef.tips` | Email for daily flavor request notifications |

## CloudFront Distribution Details

- **Protocol**: HTTP → HTTPS redirect
- **SSL Method**: SNI-only
- **Minimum TLS**: 1.2
- **Price Class**: PriceClass_100 (US, Canada, Europe, Asia)
- **IPv6**: Enabled
- **HTTP/2**: Enabled
- **Cache Behaviors**: Static content from S3, `/api/*` proxied to API Gateway

## Security Headers

The CloudFront distribution enforces the following security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-XSS-Protection: 1; mode=block`

## Flavor Request System

The flavor request feature captures visitor submissions and stores them in DynamoDB:

1. Visitor fills out the form on `/limited-edition.html`
2. POST request to `/api/flavor-request` via CloudFront → API Gateway
3. Lambda function validates and saves to DynamoDB table `WHY-Mead-FlavorRequests`
4. Daily notification Lambda (EventBridge scheduled, runs once per day):
   - Scans DynamoDB for all requests
   - Sends email summary to `mike@beef.tips` with count and recent submissions
   - Email includes flavor, name, email, notes, and submission timestamp

## Notes

- The ACM certificate must be in `us-east-1` (required for CloudFront)
- S3 bucket name is globally unique and must be specified during stack creation
- The S3 bucket is set to `Private` access, with CloudFront OAI providing access
- The S3 website endpoint is separate from the CloudFront distribution
- DynamoDB table uses TTL (`expiresAt`) for automatic cleanup of old records
- Lambda functions are packaged as a single zip file in `infra/lambda-functions.zip`
