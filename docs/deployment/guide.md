# Deployment Guide

This guide outlines production deployment expectations for DevPilot AI.

## Environments
- **Staging**: pre-release validation and performance testing
- **Production**: customer-facing workloads

## Containers & Orchestration
- Docker images are built per service.
- Kubernetes manifests live in `infra/k8s`.
- Helm charts are in `infra/helm/devpilot-ai`.

## CI/CD
- GitHub Actions workflows live in `.github/workflows`.
- Typical pipeline stages:
  1. lint/test
  2. build/push container images
  3. deploy via Helm

## Terraform
- Environment modules live in `infra/terraform/environments`.
- Modules live in `infra/terraform/modules`.

## Production Checklist
- ✅ Infrastructure provisioned (VPC, EKS, RDS)
- ✅ Secrets configured (AWS Secrets Manager)
- ✅ Observability stack deployed (Prometheus/Grafana/Loki)
- ✅ Backups and retention policies enabled
