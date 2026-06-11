import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Responsible gambling — Aviator' };

export default function ResponsibleGamblingPage() {
  return (
    <LegalShell title="Responsible gambling">
      <p>
        Gambling should stay a form of entertainment. It can lead to addiction and to financial, social and
        personal difficulties. Here is our advice and the tools available to you.
      </p>

      <h2>Stay in control</h2>
      <p>
        Only gamble money you can afford to lose. Set yourself a time and budget limit before you start. Never
        try to “win it back” after a loss. Don’t borrow money to gamble. Take regular breaks.
      </p>

      <h2>Warning signs</h2>
      <p>
        You play more than you intended, you lie about your gambling, you neglect your responsibilities, you
        gamble to escape stress or to recover losses: these are signals you should not ignore.
      </p>

      <h2>Available tools</h2>
      <p>
        On request to support, you can set up <b>deposit limits</b>, a <b>time-out</b> or a{' '}
        <b>self-exclusion</b> on your account. These measures take effect immediately and cannot be lifted
        before the chosen period ends.
      </p>

      <h2>Minors</h2>
      <p>
        Gambling is strictly reserved for people <b>18 and over</b>. Protect access to your devices and use
        parental controls if minors have access to them.
      </p>

      <h2>Need help?</h2>
      <p>
        If gambling becomes a problem, talk about it. Support organizations exist in most countries (helplines,
        specialized associations). In the UK: <b>GamCare — 0808 8020 133</b> (free helpline). Look up the
        equivalent in your country.
      </p>
    </LegalShell>
  );
}
