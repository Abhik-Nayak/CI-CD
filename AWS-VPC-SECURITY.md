# AWS VPC & Security Best Practices

## The Problem: Single EC2 in a Public Subnet

When everything (server + DB) runs on a **single EC2 in a public subnet**, it is directly exposed to the internet. If security groups aren't configured tightly, your database becomes reachable from the internet.

### Can Security Groups Alone Keep It Secure?

**Technically yes, but it's not recommended** as your only layer of defense.

Security groups are like a **lock on your front door**. A private subnet is like **putting your valuables in a bank vault**. Both help, but one is far stronger.

| Risk | Security Group Only | Private Subnet |
|---|---|---|
| Someone misconfigures a rule | DB exposed to internet | DB still unreachable |
| Security group accidentally deleted | Everything open | DB still unreachable |
| EC2 gets compromised | Attacker has direct DB access on same machine | DB is a separate resource, harder to reach |
| Zero-day exploit on your app | Attacker is already on the public internet | Attacker still can't reach DB directly |

With everything on one public EC2:

- **One misconfigured security group rule** = entire app + database exposed
- **One compromised service** = attacker gets everything (app code, DB data, credentials)
- **No defense in depth** — you're relying on a single layer

---

## Correct Approach: VPC with Public + Private Subnets

```
                    Internet
                       │
                 ┌─────┴─────┐
                 │  Internet  │
                 │  Gateway   │
                 └─────┬──────┘
                       │
         ┌─────────────┴─────────────┐
         │      PUBLIC SUBNET        │
         │                           │
         │  ┌──────────────────┐     │
         │  │  Load Balancer / │     │
         │  │  Bastion Host    │     │
         │  └──────────────────┘     │
         │                           │
         │  ┌──────────────────┐     │
         │  │   NAT Gateway    │     │
         │  └──────────────────┘     │
         └───────────┬───────────────┘
                     │
         ┌───────────┴───────────────┐
         │      PRIVATE SUBNET       │
         │                           │
         │  ┌──────────────────┐     │
         │  │  EC2 (Your App)  │     │
         │  └──────────────────┘     │
         │                           │
         │  ┌──────────────────┐     │
         │  │  RDS (Database)  │     │
         │  └──────────────────┘     │
         └───────────────────────────┘
```

### Components Explained

**Public Subnet** — has a route to the Internet Gateway. Resources here get public IPs and are directly reachable from the internet. Only put things here that *must* face the internet:

- **Load Balancer (ALB)** — accepts user traffic on port 80/443, forwards to your app
- **NAT Gateway** — lets private subnet resources reach the internet (for updates, npm install, etc.)
- **Bastion Host (optional)** — a small EC2 you SSH into, then SSH from there to private instances

**Private Subnet** — has NO direct internet access. Resources here can only be reached from within the VPC:

- **Your EC2 app server** — receives traffic only from the Load Balancer
- **Your Database (RDS)** — receives traffic only from your app server

**NAT Gateway** — sits in the public subnet, allows outbound-only internet access for private subnet resources. Your app can *call out* (download packages, call APIs) but nobody on the internet can *call in*.

---

## Traffic Flow

### Outbound (your app calling the internet)

```
Private EC2 → NAT Gateway (public subnet) → Internet Gateway → Internet
```

### Inbound (users accessing your app)

```
Internet → Internet Gateway → ALB (public subnet) → EC2 (private subnet)
```

---

## Security Group Rules

| Resource | Security Group Allows |
|---|---|
| ALB | Inbound 80/443 from `0.0.0.0/0` |
| EC2 (app) | Inbound only from ALB's security group |
| RDS (database) | Inbound only from EC2's security group |
| Bastion | Inbound SSH from your IP only |

---

## The Principle: Defense in Depth

Good security = **multiple layers**, so if one fails, others still protect you:

```
Layer 1:  Security Groups         ← can be misconfigured
Layer 2:  Private Subnet          ← network-level isolation
Layer 3:  Separate DB (RDS)       ← DB not on same machine as app
Layer 4:  IAM Roles               ← least-privilege access
Layer 5:  Encryption at rest/transit
```

If any single layer fails, the others still hold.

---

## Cost Note

NAT Gateway costs ~$32/month + data transfer charges. For a small project, some people skip it and use a **NAT instance** (a small EC2 configured as NAT) to save money, though it's more work to manage.

---

## Testing the Full Setup: Time & Cost Breakdown

### Time Estimate

| Task | Time |
|---|---|
| Create VPC, Subnets, Route Tables, IGW | ~15 min |
| Create NAT Gateway | ~5 min |
| Create Security Groups | ~10 min |
| Launch EC2 in Private Subnet | ~10 min |
| Launch RDS in Private Subnet | ~15 min (DB takes time to spin up) |
| Create ALB (Load Balancer) | ~10 min |
| Deploy your app & test | ~30 min |
| **Total Setup** | **~1.5 to 2 hours** |
| Tear down everything | ~20 min |

### Cost Per Hour

| Resource | Hourly Cost |
|---|---|
| EC2 (t3.micro) | $0.0104 |
| RDS (db.t3.micro) | $0.017 |
| ALB (Application Load Balancer) | $0.0225 |
| NAT Gateway | $0.045 |
| Bastion Host (t3.micro) | $0.0104 |
| **Total per hour** | **~$0.105/hour** |

### Cost Scenarios

**4-Hour Test (setup + test + teardown):**

```
4 hours × $0.105  =  $0.42
Data transfer      =  ~$0.01 (minimal during testing)
─────────────────────────────
Total cost         ≈  $0.50 (less than ₹45)
```

**Full Day Testing (8 hours):**

```
8 hours × $0.105  =  $0.84
Data transfer      =  ~$0.02
─────────────────────────────
Total cost         ≈  $1.00 (less than ₹85)
```

**Weekend Testing (48 hours — forgot to delete):**

```
48 hours × $0.105 =  $5.04
─────────────────────────────
Total cost         ≈  $5.00 (less than ₹425)
```

---

## Teardown Checklist (Delete in This Order)

```
Step 1:  Delete ALB                    ← stops billing immediately
Step 2:  Delete EC2 instances          ← stops billing immediately
Step 3:  Delete RDS instance           ← skip final snapshot to avoid storage cost
Step 4:  Delete NAT Gateway            ← THIS IS THE EXPENSIVE ONE, delete first if in a hurry
Step 5:  Release Elastic IPs           ← free when attached, $0.005/hr when not
Step 6:  Delete Bastion Host
Step 7:  Delete Security Groups
Step 8:  Delete Subnets, Route Tables
Step 9:  Delete Internet Gateway
Step 10: Delete VPC
```

### Things That Keep Charging if You Forget

| Resource | Silent Cost | How to Check |
|---|---|---|
| NAT Gateway | $32/month | VPC → NAT Gateways |
| Unattached Elastic IP | $3.6/month | EC2 → Elastic IPs |
| RDS not deleted | $12+/month | RDS → Databases |
| EBS Snapshots | $0.05/GB/month | EC2 → Snapshots |
| ALB running idle | $16/month | EC2 → Load Balancers |

### Pro Tip: Set a Billing Alarm Before You Start

```
AWS Console → Billing → Budgets → Create Budget
  - Amount: $5
  - Alert at: 80% ($4)
  - Email: your email
```

This way, even if you forget to delete something, AWS will email you before it gets expensive.

---

## Summary

- Security groups configured correctly = **secure today**, but one human mistake tomorrow can break it.
- Private subnets give you a **safety net** that doesn't depend on perfect configuration.
- For a production app with real user data, the extra cost is worth it.
- Always follow **defense in depth** — never rely on a single security layer.
- A full secure setup test costs **less than ₹50 (under $1)** if you test for a few hours and delete everything.
- The real risk isn't the test — it's **forgetting to delete the NAT Gateway**. Set a billing alarm and you're safe.
