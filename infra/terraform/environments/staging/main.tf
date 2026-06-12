module "vpc" {
  source = "../modules/vpc"
  name   = "devpilot-staging"
}

module "eks" {
  source = "../modules/eks"
  name   = "devpilot-staging"
}
