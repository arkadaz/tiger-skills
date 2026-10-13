---
name: tiger-terraform
description: Infrastructure written in Terraform the way a principal engineer does it. Every resource in code, remote locked state, small modules with typed inputs, one codebase for every environment, pinned versions, least privilege, nothing public by default, no secrets in code or variables files, and a reviewed plan before any apply. Use when adding or changing cloud resources, networking, permissions, databases, queues, storage or deployment setup, and when reviewing Terraform.
---

# Terraform

All infrastructure is written in Terraform. Nothing is created or changed by hand in a console. If it is not in the code, it does not exist.

The rules of `tiger-code-quality` hold here too: reuse first, plain names, no comments, nothing left behind.

## You never apply

- You write the code and produce the plan. You never run `terraform apply` or `terraform destroy` unless the user asks for it in this conversation.
- A plan that destroys or replaces anything that holds data, such as a database, a bucket, a volume or a queue, stops the work. Show the user that line and ask.
- A plan is read line by line. "It planned without errors" is not a review.

## Layout

```
infra/
  modules/           parts used more than once, each about one thing
    queue/
  environments/
    dev/             main.tf, variables.tf, outputs.tf, terraform.tfvars
    prod/
```

- Every environment is built from the same modules. They differ only in their variables. Never copy one environment's folder and edit it.
- A module is about one thing and has a reason to be used twice. Do not wrap a single resource in a module.
- Use a well-known, maintained module from the registry before writing your own, with its version pinned.
- Each folder has `main.tf`, `variables.tf`, `outputs.tf` and `versions.tf`. Split a long `main.tf` by what it builds, such as `network.tf` and `database.tf`.

## State

- State is remote, locked and encrypted. Never a local state file, and never state in the repository.
- One state per environment. Production state is separate from everything else.
- Never edit state by hand. Use `moved` blocks to rename, and `import` blocks to adopt what already exists.

## Variables and outputs

- Every variable has a `type` and a `description`. Add a `validation` where a wrong value would build the wrong thing.
- No default for what differs per environment. A missing value must stop the plan.
- Every output has a `description`. Mark what is secret as `sensitive`.
- What the program needs from the infrastructure, such as an address or a queue name, is an output, and reaches the program as a setting. See `tiger-configuration`.
- A value worked out from others is a `local`, named once.

## Resources

- Names follow one pattern: project, environment, purpose. Common tags are set once, on the provider.
- `for_each` over a map or a set for several of a kind. Not `count`, which renumbers and rebuilds the rest when one is removed.
- No `depends_on` unless the plan proves it is needed. Reference the other resource's attribute and let Terraform order them.
- No provisioners and no local scripts run from Terraform.
- `prevent_destroy` on everything that holds data.
- Versions are pinned: `required_version`, and every provider with a version constraint. The lock file is committed.

## Safe by default

- Least privilege. A permission names its actions and its resources. No `*` for either.
- Nothing is public unless the spec says so. No storage open to the world, no port open to `0.0.0.0/0` except the one public entry the spec names.
- Encrypted at rest and in transit, wherever the provider offers it.
- No secret in a `.tf` file, in a `.tfvars` file in the repository, or in a default. Secrets are read from the secret store, and created secrets are stored there.
- Backups, and a time limit on how long logs and old versions are kept, for everything that holds data.

## Smells

| The smell | The fix |
|---|---|
| a resource changed in the console | put it in the code, and import it |
| one environment's folder copied to make another | the same modules with different variables |
| `count` used for a list of things | `for_each` |
| a module around one resource, or one nobody uses twice | the resource itself |
| a hard-coded account id, region, address or name | a variable or a data source |
| a permission with `*` | the exact actions on the exact resources |
| a secret in a variables file | the secret store |
| a plan that replaces a database | stop and ask |
| an unpinned provider or module | pin it |
| `depends_on` everywhere | references between resources |

## After every change

```bash
terraform fmt -check -recursive
terraform validate
terraform plan -out=plan.tfplan
```

Also run the project's linter and security scan when it has them: `tflint`, `trivy config`, `checkov`. A module with logic in it has tests run by `terraform test`.

The plan is the verification. In your report, list what it will add, change and destroy, and paste the summary line. After an apply the user asked for, a second plan must show no changes.
