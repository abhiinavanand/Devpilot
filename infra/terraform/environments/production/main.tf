module "vpc" {
  source = "../modules/vpc"
  name   = "devpilot-production"
}

module "eks" {
  source = "../modules/eks"
  name   = "devpilot-production"
}
