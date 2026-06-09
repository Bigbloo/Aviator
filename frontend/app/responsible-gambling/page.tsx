import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Jeu responsable — Aviator' };

export default function ResponsibleGamblingPage() {
  return (
    <LegalShell title="Jeu responsable">
      <p>
        Le jeu doit rester un divertissement. Il peut entraîner une dépendance et des difficultés financières,
        sociales et personnelles. Voici nos conseils et les outils à votre disposition.
      </p>

      <h2>Garder le contrôle</h2>
      <p>
        Ne jouez que l’argent que vous pouvez vous permettre de perdre. Fixez-vous une limite de temps et de
        budget avant de commencer. Ne tentez jamais de « vous refaire » après une perte. N’empruntez pas pour
        jouer. Faites des pauses régulières.
      </p>

      <h2>Signes d’alerte</h2>
      <p>
        Vous jouez plus que prévu, vous mentez sur votre jeu, vous négligez vos obligations, vous jouez pour
        échapper au stress ou pour récupérer des pertes : ce sont des signaux à ne pas ignorer.
      </p>

      <h2>Outils disponibles</h2>
      <p>
        Sur demande auprès du support, vous pouvez mettre en place des <b>limites de dépôt</b>, une{' '}
        <b>pause (time-out)</b> ou une <b>auto-exclusion</b> de votre compte. Ces mesures prennent effet
        immédiatement et ne peuvent pas être levées avant le délai choisi.
      </p>

      <h2>Mineurs</h2>
      <p>
        Le jeu est strictement réservé aux personnes de <b>18 ans et plus</b>. Protégez l’accès à vos appareils
        et utilisez un contrôle parental si des mineurs y ont accès.
      </p>

      <h2>Besoin d’aide ?</h2>
      <p>
        Si le jeu devient un problème, parlez-en. Des organismes d’aide existent dans la plupart des pays
        (lignes d’écoute, associations spécialisées). En France : <b>Joueurs Info Service — 09 74 75 13 13</b>{' '}
        (appel non surtaxé). Recherchez l’équivalent dans votre pays.
      </p>
    </LegalShell>
  );
}
