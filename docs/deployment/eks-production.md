# AWS EKS Production Deployment

## Overview
This guide walks through production deployment using Terraform + Helm.

## Steps
1. Provision infrastructure in `infra/terraform/production`.
2. Build and push service images.
3. Deploy Helm charts in `infra/helm/devpilot-ai`.
4. Configure ingress and DNS.

## Recommended Services
- EKS for Kubernetes
- RDS for Postgres
- ElastiCache for Redis
- S3 for artifacts
