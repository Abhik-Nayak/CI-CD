# AWS VPC Migration Guide: Single EC2 → Secure Multi-Tier Architecture

## What Are We Doing?

Moving from this:

```
┌─────────────────────────────────┐
│  Single EC2 (Default VPC)       │
│  Public Subnet                  │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Node.js   │  │ PostgreSQL │  │
│  │ (PM2)     │→ │ (localhost) │  │
│  └───────────┘  └────────────┘  │
│                                 │
│  Everything exposed to internet │
└─────────────────────────────────┘
```

To this:

```
┌──────────────────────────────────────────────┐
│                  NEW VPC                      │
│                                              │
│  ┌─────────── PUBLIC SUBNET ──────────────┐  │
│  │                                        │  │
│  │  ┌─────────┐       ┌──────────────┐    │  │
│  │  │  ALB    │       │ NAT Gateway  │    │  │
│  │  │ :80/443 │       │              │    │  │
│  │  └────┬────┘       └──────────────┘    │  │
│  └───────┼────────────────────────────────┘  │
│          │                                   │
│  ┌───────┼──── PRIVATE SUBNET ────────────┐  │
│  │       ▼                                │  │
│  │  ┌─────────┐       ┌──────────────┐    │  │
│  │  │  EC2    │       │  RDS         │    │  │
│  │  │ Node.js │──────→│  PostgreSQL  │    │  │
│  │  │ (PM2)   │       │  (managed)   │    │  │
│  │  └─────────┘       └──────────────┘    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## Step 1: Create a VPC (Virtual Private Cloud)

### What is a VPC?

A VPC is your **own private network inside AWS**. Think of it like your own building — you control who enters, who leaves, and which rooms connect to each other. Every AWS account gets a "default VPC" but it's wide open. We're creating a **custom VPC** with controlled access.

### Why do we need it?

The default VPC is designed for quick starts, not security. A custom VPC lets you:

- Define exactly which resources are public and which are private
- Control traffic flow between resources
- Isolate your database from the internet completely

### How to create it

```
AWS Console → VPC → Create VPC

  Name tag:    my-app-vpc
  CIDR block:  10.0.0.0/16
```

### What is CIDR 10.0.0.0/16?

CIDR defines how many IP addresses your VPC can have.

```
10.0.0.0/16 = 65,536 IP addresses (10.0.0.0 to 10.0.255.255)

Think of it like:
  10.0 = your building's address (fixed)
  0.0  = room numbers (you can assign these)
  /16  = how many rooms you get (65,536)
```

You don't need all 65,536 — but it's free and gives room to grow.

### When to use

Always create a custom VPC for any production or serious application. Only use the default VPC for quick tests or throwaway experiments.

---

## Step 2: Create Subnets

### What is a Subnet?

A subnet is a **section of your VPC** with its own rules. Like dividing your building into a **lobby** (public, anyone can enter) and **private offices** (only employees with badges).

### Why do we need multiple subnets?

- **Public subnets** — for resources that MUST face the internet (load balancer)
- **Private subnets** — for resources that should NEVER be directly reachable (app server, database)
- **Multiple AZs** — AWS requires subnets in at least 2 Availability Zones for ALB and RDS (for high availability)

### How to create them

```
VPC → Subnets → Create Subnet

Public Subnet 1:
  Name:       public-subnet-1a
  VPC:        my-app-vpc
  AZ:         ap-south-1a
  CIDR:       10.0.1.0/24         ← 256 IPs (10.0.1.0 to 10.0.1.255)

Public Subnet 2:
  Name:       public-subnet-1b
  VPC:        my-app-vpc
  AZ:         ap-south-1b
  CIDR:       10.0.2.0/24         ← 256 IPs

Private Subnet 1 (for EC2):
  Name:       private-subnet-1a
  VPC:        my-app-vpc
  AZ:         ap-south-1a
  CIDR:       10.0.3.0/24

Private Subnet 2 (for RDS):
  Name:       private-subnet-1b
  VPC:        my-app-vpc
  AZ:         ap-south-1b
  CIDR:       10.0.4.0/24
```

### Why 2 public + 2 private?

```
ALB (Load Balancer)  → requires subnets in at least 2 AZs
RDS (Database)       → requires subnets in at least 2 AZs for failover

If ap-south-1a goes down, traffic shifts to ap-south-1b automatically.
```

### When a subnet is "public" vs "private"

A subnet is NOT public or private by itself. It becomes public ONLY when its route table has a route to an Internet Gateway. We'll set that up in the next steps.

---

## Step 3: Create and Attach an Internet Gateway (IGW)

### What is an Internet Gateway?

An IGW is the **front door of your VPC**. It connects your VPC to the internet. Without it, nothing in your VPC can reach the internet, and nobody on the internet can reach your VPC.

### Why do we need it?

Your load balancer needs to accept traffic from users on the internet. The IGW makes that possible. Only resources in the **public subnet** (with a route to the IGW) will be internet-accessible.

### How to create it

```
VPC → Internet Gateways → Create Internet Gateway
  Name:  my-app-igw

Then: Actions → Attach to VPC → Select my-app-vpc
```

### When to use

Every VPC that needs internet access needs exactly ONE Internet Gateway. It's free — no hourly charges.

---

## Step 4: Create a NAT Gateway

### What is a NAT Gateway?

NAT (Network Address Translation) Gateway allows resources in your **private subnet** to access the internet **outbound only**. The internet cannot initiate a connection back in.

### Why do we need it?

Your EC2 in the private subnet needs to:

- Download npm packages (`npm install`)
- Pull code from GitHub (`git pull`)
- Call external APIs
- Download OS updates

Without a NAT Gateway, your private EC2 is completely cut off from the internet — it can't even download updates.

### How it works

```
Private EC2 wants to run: npm install express

EC2 (private) → NAT Gateway (public subnet) → IGW → Internet → npmjs.com
                                                                    │
Response comes back the same path:                                  │
EC2 (private) ← NAT Gateway (public subnet) ← IGW ← Internet ←────┘

But if someone on the internet tries to connect TO your EC2:
Internet → IGW → NAT Gateway → ✖ BLOCKED (NAT only allows outbound)
```

### How to create it

```
VPC → NAT Gateways → Create NAT Gateway
  Name:              my-app-nat
  Subnet:            public-subnet-1a    ← MUST be in a PUBLIC subnet
  Connectivity:      Public
  Elastic IP:        Click "Allocate Elastic IP"
```

### Why does NAT Gateway sit in the public subnet?

It needs internet access itself (via IGW) to forward traffic from your private resources. Think of it like a **receptionist in the lobby** — they're in the public area but they carry messages to/from the private offices.

### Cost warning

```
NAT Gateway = ~$0.045/hour = ~$32/month + data transfer charges
This is the most expensive part of this setup.
DELETE IT when you're done testing.
```

### When to use

- When private subnet resources need outbound internet access
- Alternative: NAT Instance (a small EC2 configured as NAT) — cheaper (~$4/month) but you manage it yourself

---

## Step 5: Configure Route Tables

### What is a Route Table?

A route table is like a **direction board** — it tells traffic where to go. Every subnet is associated with a route table that defines how traffic flows.

### Why do we need separate route tables?

- Public subnet traffic → goes through Internet Gateway (direct internet)
- Private subnet traffic → goes through NAT Gateway (outbound-only internet)

If they shared the same route table, private resources would be public too — defeating the purpose.

### How to create them

**Public Route Table:**

```
VPC → Route Tables → Create Route Table
  Name:   public-rt
  VPC:    my-app-vpc

Edit Routes → Add Route:
  Destination:  0.0.0.0/0        ← "all internet traffic"
  Target:       my-app-igw       ← send to Internet Gateway

Subnet Associations → Edit:
  Associate:  public-subnet-1a, public-subnet-1b
```

**Private Route Table:**

```
VPC → Route Tables → Create Route Table
  Name:   private-rt
  VPC:    my-app-vpc

Edit Routes → Add Route:
  Destination:  0.0.0.0/0        ← "all internet traffic"
  Target:       my-app-nat       ← send to NAT Gateway (outbound only)

Subnet Associations → Edit:
  Associate:  private-subnet-1a, private-subnet-1b
```

### How traffic flows after this

```
User request → IGW → ALB (public-rt says: use IGW) → EC2 (private)
EC2 npm install → NAT (private-rt says: use NAT) → IGW → Internet
Hacker tries to reach EC2 directly → IGW → ✖ No route to private subnet
```

### What does 0.0.0.0/0 mean?

```
0.0.0.0/0 = "any IP address on the internet"
It's a catch-all rule: if traffic doesn't match any other route, use this one.
```

---

## Step 6: Create Security Groups

### What is a Security Group?

A security group is a **virtual firewall** for your resource. It controls what traffic can come IN (inbound) and go OUT (outbound). Think of it like a **bouncer at each door** — checking who's allowed in and out.

### Why do we need separate security groups?

Each resource has different needs:

```
ALB    → needs to accept traffic from everyone on the internet
EC2    → should ONLY accept traffic from the ALB
RDS    → should ONLY accept traffic from the EC2
```

If they shared one security group, you couldn't enforce these restrictions.

### How they chain together

```
Internet → [ALB-SG allows :80/443] → ALB
              ALB → [EC2-SG allows from ALB-SG only] → EC2
                       EC2 → [RDS-SG allows from EC2-SG only] → RDS

A hacker trying to reach RDS directly:
Internet → [RDS-SG] → ✖ BLOCKED (only ec2-sg is allowed)
```

### How to create them

**ALB Security Group:**

```
EC2 → Security Groups → Create
  Name:        alb-sg
  Description: Allow HTTP/HTTPS from internet
  VPC:         my-app-vpc

  Inbound Rules:
    HTTP  (80)   → Source: 0.0.0.0/0    (anyone)
    HTTPS (443)  → Source: 0.0.0.0/0    (anyone)

  Outbound Rules:
    All traffic  → Destination: 0.0.0.0/0
```

**EC2 Security Group:**

```
  Name:        ec2-sg
  Description: Allow traffic only from ALB
  VPC:         my-app-vpc

  Inbound Rules:
    Custom TCP (5000)  → Source: alb-sg      ← ONLY the load balancer
    SSH (22)           → Source: YOUR_IP/32  ← only your IP, for debugging

  Outbound Rules:
    All traffic → Destination: 0.0.0.0/0     ← so EC2 can reach RDS & NAT
```

**RDS Security Group:**

```
  Name:        rds-sg
  Description: Allow traffic only from EC2
  VPC:         my-app-vpc

  Inbound Rules:
    PostgreSQL (5432) → Source: ec2-sg        ← ONLY your app server

  Outbound Rules:
    None needed
```

### Key concept: Security Group chaining

Notice we use **security group IDs** as sources, not IP addresses:

```
Source: alb-sg     ← means "any resource attached to alb-sg"
Source: ec2-sg     ← means "any resource attached to ec2-sg"
```

This is better than using IPs because:

- IPs can change (especially private IPs if you replace an EC2)
- Security group references update automatically
- It's self-documenting: "only the ALB can talk to EC2"

---

## Step 7: Create the Database (RDS)

### What is RDS?

RDS (Relational Database Service) is AWS's **managed database**. Instead of installing PostgreSQL on your EC2 and managing it yourself, AWS handles backups, updates, patching, and failover.

### Why move from localhost PostgreSQL to RDS?

| Localhost DB | RDS |
|---|---|
| If EC2 dies, DB data is lost | Automated backups, data survives |
| You manage updates/patches | AWS manages everything |
| No failover | Multi-AZ failover available |
| On same machine as app | Isolated in private subnet |
| If app is hacked, DB is compromised | DB is a separate resource with its own security |

### How to create it

**Step 7a — Create DB Subnet Group:**

```
RDS → Subnet Groups → Create
  Name:     my-app-db-subnets
  VPC:      my-app-vpc
  Subnets:  private-subnet-1a, private-subnet-1b
```

Why a subnet group? RDS needs to know which subnets it can use. By giving it only private subnets, we ensure the DB is never in a public subnet.

**Step 7b — Create RDS Instance:**

```
RDS → Create Database
  Engine:              PostgreSQL
  Version:             15.x (or latest)
  Template:            Free tier
  DB Instance ID:      my-app-db
  Master username:     postgres
  Master password:     (use a STRONG password, not "postgres")
  Instance class:      db.t3.micro
  Storage:             20 GB (default)
  VPC:                 my-app-vpc
  Subnet group:        my-app-db-subnets
  Public access:       ✖ NO ← CRITICAL — never make DB public
  Security group:      rds-sg
  Database name:       TODO
  Port:                5432
```

After creation (~5-10 min), note the endpoint:

```
my-app-db.abc123.ap-south-1.rds.amazonaws.com
```

### When to use RDS vs localhost DB

```
Learning/prototyping → localhost is fine
Any real users/data  → always use RDS (or similar managed DB)
```

---

## Step 8: Launch EC2 in Private Subnet

### Why a new EC2?

Your current EC2 is in the default VPC's public subnet. You can't just "move" it — you need to launch a new one inside your custom VPC's private subnet.

### How to create it

```
EC2 → Launch Instance
  Name:             my-app-server
  AMI:              Amazon Linux 2023
  Instance type:    t3.micro
  Key pair:         select your existing key

  Network settings:
    VPC:            my-app-vpc
    Subnet:         private-subnet-1a
    Auto-assign IP: DISABLE ← private subnet, no public IP needed
    Security group: ec2-sg

  Storage:          8 GB (default)

  Advanced → IAM Instance Profile:
    Create/select a role with AmazonSSMManagedInstanceCore policy
    (this lets you connect via Session Manager instead of SSH)
```

### How to connect (no SSH from internet)

Since this EC2 has no public IP, you can't SSH directly. Use **AWS Session Manager**:

```
AWS Console → EC2 → Select Instance → Connect → Session Manager → Connect
```

This opens a terminal in your browser — no SSH key needed, no port 22 needed.

### How to set up your app

```bash
# Install Node.js
sudo yum install -y git
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
sudo npm install -g pm2

# Clone your code
git clone https://github.com/your-username/CI-CD.git
cd CI-CD
npm run install-all

# Build the frontend
cd client && npm run build && cd ..
```

### Update database connection

Edit `server/.env` to point to RDS instead of localhost:

```env
# BEFORE (localhost)
PG_USER=postgres
PG_PASSWORD=postgres
PG_HOST=localhost
PG_PORT=5434
PG_DATABASE=TODO

# AFTER (RDS in private subnet)
PG_USER=postgres
PG_PASSWORD=your-strong-rds-password
PG_HOST=my-app-db.abc123.ap-south-1.rds.amazonaws.com
PG_PORT=5432
PG_DATABASE=TODO
```

### Start the app

```bash
pm2 start ecosystem.config.js
pm2 logs    # check for errors
```

---

## Step 9: Create Application Load Balancer (ALB)

### What is an ALB?

An ALB (Application Load Balancer) is a **traffic distributor** that sits in the public subnet and forwards requests to your EC2 in the private subnet. It's the only thing users interact with directly.

### Why do we need it?

```
Without ALB:  Users → EC2 (must be public, exposed)
With ALB:     Users → ALB (public) → EC2 (private, hidden)
```

Additional benefits:

- Handles SSL/HTTPS termination (users connect via HTTPS, ALB talks to EC2 via HTTP)
- Health checks — automatically stops sending traffic to unhealthy instances
- Can distribute traffic across multiple EC2s when you scale

### How to create it

**Step 9a — Create Target Group:**

```
EC2 → Target Groups → Create
  Target type:     Instances
  Name:            my-app-tg
  Protocol:        HTTP
  Port:            5000              ← your Node.js app port
  VPC:             my-app-vpc

  Health check:
    Path:          /                 ← ALB pings this to check if app is alive
    Interval:      30 seconds

  Register targets:
    Select your new EC2 → Include as pending → Create
```

**Step 9b — Create ALB:**

```
EC2 → Load Balancers → Create → Application Load Balancer
  Name:            my-app-alb
  Scheme:          Internet-facing    ← must be public
  IP address type: IPv4
  VPC:             my-app-vpc
  Subnets:         public-subnet-1a, public-subnet-1b

  Security group:  alb-sg

  Listener:
    Protocol: HTTP
    Port:     80
    Action:   Forward to my-app-tg
```

After creation, you get a DNS name:

```
my-app-alb-123456.ap-south-1.elb.amazonaws.com
```

Open this URL in your browser — your app should load!

### When to add HTTPS

For production, add an HTTPS listener:

```
1. Get a free SSL certificate from AWS Certificate Manager (ACM)
2. Add HTTPS (443) listener on ALB → forward to my-app-tg
3. Redirect HTTP (80) → HTTPS (443)
```

---

## Step 10: Setup Bastion Host (Optional)

### What is a Bastion Host?

A bastion host is a **small, hardened EC2 in the public subnet** that acts as a jump point to access resources in private subnets. It's like a **security checkpoint** — you enter the checkpoint first, then from there you can access the restricted area.

### Why do we need it?

Your EC2 and RDS are in private subnets — you can't reach them directly from the internet. Sometimes you need to:

- SSH into the EC2 for debugging
- Connect to the database for manual queries
- Troubleshoot network issues

### How it works

```
Without bastion:
  Your laptop → EC2 (private) → ✖ BLOCKED

With bastion:
  Your laptop → Bastion (public, SSH) → EC2 (private, SSH) → ✔ Works
  Your laptop → Bastion (public, SSH) → RDS (private, port 5432) → ✔ Works
```

### How to create it

```
EC2 → Launch Instance
  Name:          bastion-host
  AMI:           Amazon Linux 2023
  Instance type: t3.micro
  Subnet:        public-subnet-1a
  Auto-assign IP: ENABLE
  Security group: bastion-sg

Bastion Security Group:
  Inbound:  SSH (22) → Source: YOUR_IP/32 ONLY
  Outbound: All traffic
```

Update EC2 security group to allow SSH from bastion:

```
ec2-sg → Add inbound rule:
  SSH (22) → Source: bastion-sg
```

### How to use it (SSH tunneling)

```bash
# Connect to bastion first, then jump to private EC2
ssh -J ec2-user@bastion-public-ip ec2-user@ec2-private-ip

# Or tunnel to RDS through bastion (for DB GUI tools)
ssh -L 5432:my-app-db.abc123.rds.amazonaws.com:5432 ec2-user@bastion-public-ip
# Now connect your DB tool to localhost:5432
```

### When to use vs Session Manager

```
Session Manager (SSM):  Free, no bastion needed, browser-based
                        Good for: quick terminal access, running commands

Bastion Host:           ~$4/month (t3.micro), needs management
                        Good for: SSH tunneling, DB access from local tools,
                                  SCP file transfers, long debugging sessions
```

For learning/small projects, **Session Manager is enough**. Add a bastion when you need SSH tunneling or local DB tool access.

---

## Step 11: Update CI/CD Pipeline

### Why update it?

Your current GitHub Actions workflow SSHs directly into the EC2's public IP. But the new EC2 has no public IP (it's in a private subnet), so SSH from the internet won't work.

### Option A: Deploy via AWS SSM (Recommended)

```yaml
- name: Deploy via SSM
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: ap-south-1
  run: |
    aws ssm send-command \
      --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
      --document-name "AWS-RunShellScript" \
      --parameters 'commands=[
        "cd /home/ec2-user/CI-CD",
        "git pull origin dev",
        "npm run install-all",
        "cd client && npm run build && cd ..",
        "pm2 restart ecosystem.config.js"
      ]'
```

### Option B: Deploy via Bastion (SSH jump)

```yaml
- name: Deploy via Bastion
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.EC2_PRIVATE_IP }}
    username: ec2-user
    key: ${{ secrets.SSH_KEY }}
    proxy_host: ${{ secrets.BASTION_HOST }}
    proxy_username: ec2-user
    proxy_key: ${{ secrets.SSH_KEY }}
    script: |
      cd ~/CI-CD
      git pull origin dev
      npm run install-all
      cd client && npm run build && cd ..
      pm2 restart ecosystem.config.js
```

---

## Step 12: Verify & Cleanup

### Verification checklist

```
✅ Open ALB URL in browser → app loads
✅ Create a todo → saved (DB connection works)
✅ Delete a todo → removed (full CRUD works)
✅ Push to dev branch → CI/CD deploys automatically
✅ Try to access EC2 public IP → doesn't exist (expected)
✅ Try to connect to RDS endpoint from your laptop → timeout (expected)
✅ Session Manager works → can access EC2 terminal
```

### Delete old resources

```
Only after everything is verified:
  1. Terminate old EC2 in default VPC
  2. Release any old Elastic IPs
  3. Delete old security groups (if custom)
```

---

## Complete Migration Checklist

```
□ Step 1:  Create VPC (10.0.0.0/16)
□ Step 2:  Create 4 Subnets (2 public, 2 private)
□ Step 3:  Create & attach Internet Gateway
□ Step 4:  Create NAT Gateway in public subnet
□ Step 5:  Configure Route Tables (public-rt, private-rt)
□ Step 6:  Create Security Groups (alb-sg, ec2-sg, rds-sg)
□ Step 7:  Create RDS in private subnet
□ Step 8:  Launch EC2 in private subnet, deploy app
□ Step 9:  Create ALB in public subnet
□ Step 10: (Optional) Create Bastion Host
□ Step 11: Update CI/CD pipeline
□ Step 12: Verify everything, delete old resources
```

---

## Quick Reference: What Lives Where

```
┌──────────────┬─────────────────┬────────────────────────────────┐
│ Resource     │ Subnet          │ Why                            │
├──────────────┼─────────────────┼────────────────────────────────┤
│ ALB          │ Public          │ Must accept internet traffic   │
│ NAT Gateway  │ Public          │ Needs IGW access for forwarding│
│ Bastion Host │ Public          │ SSH entry point from internet  │
│ EC2 (App)    │ Private         │ Hidden from internet           │
│ RDS (DB)     │ Private         │ Hidden from internet           │
└──────────────┴─────────────────┴────────────────────────────────┘
```

---

## Interview Questions & Answers

### Basic Questions

**Q1: What is a VPC?**

A VPC (Virtual Private Cloud) is a logically isolated virtual network within AWS where you launch your resources. It gives you full control over IP addressing, subnets, route tables, and network gateways. Think of it as your own private data center inside AWS.

---

**Q2: What is the difference between a public and private subnet?**

A **public subnet** has a route table entry pointing `0.0.0.0/0` to an Internet Gateway, so resources with public IPs can communicate directly with the internet. A **private subnet** has no such route — its resources cannot be directly reached from the internet. If it has a route to a NAT Gateway, resources can make outbound connections only.

---

**Q3: What is an Internet Gateway?**

An Internet Gateway is a horizontally scaled, redundant, and highly available VPC component that allows communication between your VPC and the internet. It serves two purposes: providing a target in your route table for internet-bound traffic, and performing NAT for instances with public IPv4 addresses.

---

**Q4: What is a NAT Gateway and why is it needed?**

A NAT Gateway enables instances in a private subnet to connect to the internet (for updates, API calls, package downloads) while preventing the internet from initiating connections to those instances. It sits in a public subnet, translates private IPs to its own public IP for outbound requests, and routes responses back.

---

**Q5: What is a Security Group?**

A Security Group acts as a virtual firewall at the instance level. It controls inbound and outbound traffic with allow rules (there are no deny rules). Security Groups are **stateful** — if you allow inbound traffic, the response is automatically allowed outbound, regardless of outbound rules.

---

### Intermediate Questions

**Q6: What is the difference between a Security Group and a NACL (Network ACL)?**

| Feature | Security Group | NACL |
|---|---|---|
| Level | Instance level | Subnet level |
| Rules | Allow only | Allow AND Deny |
| Stateful? | Yes (return traffic auto-allowed) | No (must explicitly allow return traffic) |
| Rule evaluation | All rules evaluated together | Rules evaluated in number order, first match wins |
| Default | Denies all inbound, allows all outbound | Allows all inbound and outbound |

Use Security Groups as your primary firewall. Use NACLs as an additional layer when you need to explicitly deny specific IPs or ranges.

---

**Q7: What is a Bastion Host and when would you use one?**

A Bastion Host is a hardened EC2 instance in a public subnet that serves as a secure entry point to access resources in private subnets. You SSH into the bastion first, then from there SSH into private instances. Use it when you need SSH tunneling, local DB tool access, or file transfers. For simple terminal access, AWS Session Manager is a free alternative that doesn't require a bastion.

---

**Q8: Can you explain VPC Peering?**

VPC Peering is a networking connection between two VPCs that enables traffic to route between them using private IP addresses. The VPCs can be in the same account, different accounts, or even different regions. Traffic stays on the AWS backbone (never crosses the public internet). Use case: connecting a development VPC to a shared-services VPC.

---

**Q9: What is the difference between an ALB and NLB?**

| Feature | ALB (Application) | NLB (Network) |
|---|---|---|
| Layer | Layer 7 (HTTP/HTTPS) | Layer 4 (TCP/UDP) |
| Routing | Path-based, host-based | Connection-based |
| Speed | Slower (inspects content) | Faster (passes through) |
| SSL | Terminates SSL | Can pass through SSL |
| Use case | Web apps, APIs, microservices | Gaming, IoT, extreme performance |

For a typical Node.js web app, **ALB** is the right choice.

---

**Q10: How does an ALB health check work?**

The ALB periodically sends HTTP requests to a specified path (e.g., `/`) on each registered target. If a target returns a success status code (default: 200) within the timeout period for a configured number of consecutive checks, it's marked **healthy**. If it fails consecutive checks, it's marked **unhealthy** and the ALB stops sending traffic to it. This ensures users never hit a broken server.

---

### Advanced Questions

**Q11: Your EC2 in a private subnet can't reach the internet even though you have a NAT Gateway. How would you troubleshoot?**

Check in this order:

```
1. Route Table: Does the private subnet's route table have
   0.0.0.0/0 → NAT Gateway?

2. NAT Gateway status: Is the NAT Gateway in "Available" state?
   (It takes a few minutes after creation)

3. NAT Gateway subnet: Is the NAT Gateway in a PUBLIC subnet
   with a route to the IGW?

4. Security Group: Does the EC2's outbound rules allow the traffic?
   (Default allows all outbound, but someone may have restricted it)

5. NACL: Does the subnet's NACL allow outbound traffic on the
   required port AND inbound on ephemeral ports (1024-65535)?

6. Elastic IP: Does the NAT Gateway have an Elastic IP attached?
```

---

**Q12: How would you design a multi-tier architecture for high availability?**

```
                     Route 53 (DNS)
                         │
                    CloudFront (CDN)
                         │
                   ┌─────┴─────┐
                   │    ALB    │
                   └──┬────┬──┘
                      │    │
            ┌─────────┘    └─────────┐
     AZ-1a  │                        │  AZ-1b
   ┌────────┴────────┐    ┌─────────┴────────┐
   │  EC2 (App)      │    │  EC2 (App)       │
   │  Auto Scaling   │    │  Auto Scaling    │
   └────────┬────────┘    └─────────┬────────┘
            │                       │
   ┌────────┴────────┐    ┌─────────┴────────┐
   │  RDS Primary    │───→│  RDS Standby     │
   │  (writes)       │    │  (auto failover) │
   └─────────────────┘    └──────────────────┘
```

Key points: resources span at least 2 AZs, Auto Scaling Group replaces failed EC2s, RDS Multi-AZ provides automatic database failover, ALB distributes traffic evenly.

---

**Q13: What is the principle of least privilege and how does it apply to VPC security?**

The principle of least privilege means granting only the minimum permissions necessary. In VPC terms:

- **Security Groups**: EC2 only accepts traffic from ALB (not the whole internet). RDS only accepts traffic from EC2 (not the whole VPC).
- **Subnets**: DB in private subnet — not just relying on security group rules.
- **IAM Roles**: EC2 has only the permissions it needs (SSM access, not full admin).
- **NACLs**: Additional deny rules for known bad IP ranges.

Every layer adds defense — if one fails, others still protect you.

---

**Q14: What happens if the NAT Gateway's Availability Zone goes down?**

If the AZ hosting your NAT Gateway fails, all private subnet instances routing through it lose internet access. To handle this:

```
Solution: Create one NAT Gateway per AZ

AZ-1a: NAT Gateway 1 ← private-subnet-1a routes here
AZ-1b: NAT Gateway 2 ← private-subnet-1b routes here
```

This adds cost (~$32/month per NAT Gateway) but ensures AZ-level resilience.

---

**Q15: How would you securely store database credentials instead of putting them in a .env file?**

Use **AWS Secrets Manager** or **AWS Systems Manager Parameter Store**:

```
1. Store credentials in Secrets Manager (encrypted at rest)
2. Give EC2's IAM role permission to read the secret
3. App fetches credentials at startup:

   const secret = await secretsManager.getSecretValue({
     SecretId: 'my-app/db-credentials'
   })
   const { username, password } = JSON.parse(secret.SecretString)

Benefits:
- Credentials not in source code or .env files
- Automatic rotation possible
- Audit trail of who accessed credentials
- If EC2 is compromised, credentials aren't on disk
```

---

**Q16: Explain the difference between stateful and stateless firewalls in the context of AWS.**

**Stateful (Security Groups):** Remembers the connection state. If you allow inbound HTTP on port 80, the response traffic is automatically allowed out — you don't need an outbound rule for it. It tracks: "this inbound packet is part of an established connection."

**Stateless (NACLs):** Evaluates every packet independently with no memory of previous packets. If you allow inbound on port 80, you must ALSO explicitly allow outbound on ephemeral ports (1024-65535) for the response. It doesn't know that the outbound packet is a response to an inbound request.

```
Example - allowing HTTP traffic:

Security Group (stateful):
  Inbound: Allow port 80     ← response auto-allowed, done!

NACL (stateless):
  Inbound:  Allow port 80    ← request comes in
  Outbound: Allow port 1024-65535  ← you MUST add this for response
```
