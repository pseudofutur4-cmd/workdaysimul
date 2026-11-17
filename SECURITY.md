# Security policy

HCM Practice Lab is intended for local use with synthetic data. Do not place real employee information, production credentials, or confidential company records in it. Shared practice accounts are part of the learning experience.

The current development branch is the supported version; older snapshots do not receive separate backports. Review [the security assessment](handbook/security-review.md) before deploying or sharing an instance.

## Reporting an issue

Use GitHub's private vulnerability reporting option if the repository displays it under Security. If it is unavailable, open an issue requesting a private contact method without posting an exploit, session token, database, personal data, or sensitive reproduction details. There is no guaranteed response time or paid security support.

A useful private report identifies the affected commit, required account or role, expected access boundary, observed result, and a reproduction using synthetic data. Test only your own instance or one for which you have permission.

## Deployment boundary

The repository does not claim ISO certification, OWASP certification, a completed independent penetration test, or freedom from vulnerabilities. The review records the checks performed and their limits. Public hosting requires further work on identity, transport, abuse protection, monitoring, and operating procedures.
