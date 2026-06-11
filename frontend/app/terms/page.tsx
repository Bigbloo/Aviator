import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Terms — Aviator' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        By accessing Aviator (“the Service”), you accept these terms. If you do not accept them, do not use the
        Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be <b>18 or older</b> (or the legal gambling age in your jurisdiction, if higher) and reside in
        a country where online gambling is permitted. It is your responsibility to verify that your
        participation is lawful. The Service may be prohibited in some territories.
      </p>

      <h2>2. Account</h2>
      <p>
        One account per person. You are responsible for keeping your credentials confidential and for any
        activity on your account. The information you provide (name, email, address) must be accurate; false
        information may lead to account suspension and to withdrawals being blocked.
      </p>

      <h2>3. Deposits and withdrawals</h2>
      <p>
        Deposits and withdrawals are made in cryptocurrency (USDT and others). Transactions are irreversible;
        check the address before sending anything. Withdrawals may be subject to a compliance check (AML/CFT)
        before approval. Network fees apply.
      </p>

      <h2>4. How the game works</h2>
      <p>
        The multiplier and the crash point are determined by the server. Bets are final once placed; the
        cash-out must happen before the crash. No winnings are guaranteed — the game has a house edge.
      </p>

      <h2>5. Prohibited conduct</h2>
      <p>
        The following are prohibited: fraud, the use of bots or automation, exploiting bugs, money laundering,
        and creating multiple accounts. Any breach may lead to account closure and to the forfeiture of the
        balances concerned.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        The Service is provided “as is”. We cannot be held liable for losses related to gambling, technical
        interruptions, crypto-asset volatility, or misuse.
      </p>

      <h2>7. Responsible gambling</h2>
      <p>
        Gambling can be addictive. See our <a href="/responsible-gambling">Responsible gambling</a> page for
        help and limit-setting tools.
      </p>

      <h2>8. Changes and governing law</h2>
      <p>
        We may change these terms at any time. Continued use constitutes acceptance. The governing law and
        competent jurisdiction are those of the country where the operating license is held.
      </p>
    </LegalShell>
  );
}
