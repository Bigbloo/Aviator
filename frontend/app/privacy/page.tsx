import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Privacy — Aviator' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy describes the data we collect and how we use it, in accordance with the GDPR and applicable
        laws.
      </p>

      <h2>1. Data collected</h2>
      <p>
        At sign-up: username, email, first name, last name, postal address. During use: crypto
        deposit/withdrawal address, bet and transaction history, IP address, technical data (browser, device).
      </p>

      <h2>2. Purposes</h2>
      <p>
        Account and game management, processing of deposits/withdrawals, fraud and money-laundering prevention
        (AML/CFT), compliance with legal obligations, and improvement of the Service.
      </p>

      <h2>3. Legal basis</h2>
      <p>
        Performance of the contract (providing the Service), legal obligations (compliance, anti-money
        laundering), and legitimate interest (security, fraud prevention).
      </p>

      <h2>4. Retention</h2>
      <p>
        Data is kept for the duration of the contractual relationship, then for the period required by legal
        obligations (in particular accounting and anti-money-laundering), then deleted or anonymized.
      </p>

      <h2>5. Sharing</h2>
      <p>
        Your data may be shared with our crypto payment and hosting providers, and with authorities where the
        law requires it. We do not sell your data.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You have the right to access, rectify, erase, restrict, port, and object. To exercise these rights,
        contact us at the support address. You may also refer the matter to the competent data protection
        authority.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use local storage (localStorage) for the game session, age confirmation, and preferences. No
        third-party advertising cookie is required for the Service to work.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are stored hashed (bcrypt). Administrator access and withdrawals are protected. As no system
        is infallible, we encourage you to protect your credentials.
      </p>
    </LegalShell>
  );
}
