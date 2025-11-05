# Security Best Practices

## ⚠️ CRITICAL: Never Commit Sensitive Data

### What NOT to commit:
- AWS Access Keys / Secret Keys
- Database passwords
- API keys (Google AI, Runway, etc.)
- JWT secrets (production)
- Service account credentials

---

## ✅ Current Security Status

### Git Repository - Clean ✓
- `.gitignore` properly configured
- `application-local.yml` excluded from git
- Only `.example` files committed
- No credentials in git history

### Files Protected by .gitignore:
```
.env
src/main/resources/application-local.yml
*-service-account.json
*-credentials.json
```

---

## 🔐 Secure Configuration Management

### 1. Local Development (.env or application-local.yml)

**Copy the example file:**
```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
```

**Add your real credentials:**
```yaml
# application-local.yml (NOT committed to git)
spring:
  datasource:
    password: your_real_password

jwt:
  secret: your_secure_random_256_bit_secret_here

aws:
  s3:
    access-key: YOUR_AWS_ACCESS_KEY_ID
    secret-key: YOUR_AWS_SECRET_ACCESS_KEY
```

### 2. Production Deployment (Environment Variables)

**AWS Elastic Beanstalk:**
```bash
# Set via EB Console or eb setenv command
eb setenv AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx
```

**Or via `eb-env-vars.json` (in .gitignore):**
```json
{
  "DB_PASSWORD": "xxx",
  "AWS_ACCESS_KEY_ID": "xxx",
  "AWS_SECRET_ACCESS_KEY": "xxx",
  "JWT_SECRET": "xxx"
}
```

### 3. GitHub Actions (Secrets)

Store in GitHub repository settings → Secrets and variables → Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DB_PASSWORD`
- `JWT_SECRET`

---

## 🚨 If Credentials Were Exposed

### Immediate Actions:

1. **Rotate AWS Keys:**
   ```
   AWS Console → IAM → Users → [Your User] → Security credentials
   → Delete old access key → Create new access key
   ```

2. **Change Database Password:**
   ```sql
   ALTER USER 'your_user'@'%' IDENTIFIED BY 'new_secure_password';
   ```

3. **Update JWT Secret:**
   Generate new secret (256-bit minimum):
   ```bash
   openssl rand -base64 32
   ```

4. **Update All Environments:**
   - Local: `application-local.yml`
   - AWS EB: Update environment variables
   - GitHub Actions: Update secrets

---

## 📋 Security Checklist

Before pushing code:
- [ ] No `.env` files committed
- [ ] No `application-local.yml` committed
- [ ] No API keys in code
- [ ] All secrets use environment variables
- [ ] `.gitignore` includes all sensitive files

Before deploying:
- [ ] All environment variables set in deployment environment
- [ ] Production uses different credentials than development
- [ ] Database passwords are strong (16+ characters)
- [ ] JWT secret is 256-bit minimum

---

## 🔍 Verify Your Repository

**Check for accidentally committed secrets:**
```bash
# Search git history for potential secrets
git log --all --full-history --source -- '*local.yml'
git log -p --all -S "password" -- '*.yml' '*.properties'

# Use git-secrets (recommended)
git secrets --scan-history
```

**Clean git history if needed:**
```bash
# Use BFG Repo Cleaner (easier) or git filter-branch
# WARNING: Rewrites history, requires force push
bfg --replace-text passwords.txt
```

---

## 📚 Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)

---

## 🛡️ Automated Protection

**Pre-commit Hook (Recommended):**
```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached --name-only | grep -E "\.env$|application-local\.yml$"; then
  echo "ERROR: Attempting to commit sensitive files!"
  exit 1
fi

if git diff --cached | grep -iE "aws_secret_access_key|password.*=.*[^$]"; then
  echo "ERROR: Potential hardcoded credentials detected!"
  exit 1
fi
```

**GitHub Secret Scanning:**
- Automatically enabled for public repositories
- Alerts on push if secrets detected
- Configure in repository settings

---

## ⚡ Quick Reference

| Credential Type | Local Dev | AWS EB | GitHub Actions |
|----------------|-----------|---------|----------------|
| DB Password | `application-local.yml` | EB env vars | Secrets |
| AWS Keys | `application-local.yml` | EB env vars | Secrets |
| JWT Secret | `application-local.yml` | EB env vars | Secrets |
| API Keys | `application-local.yml` | EB env vars | Secrets |

**Remember:**
- Local config files → `.gitignore`
- Production secrets → Environment variables
- Never commit → Real credentials
