terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

module "vpc" {
  source = "../modules/vpc"
  name   = "devpilot-production"
}

module "eks" {
  source = "../modules/eks"
  name   = "devpilot-production"
}

module "rds" {
  source = "../modules/rds"
  name   = "devpilot-production"
}
