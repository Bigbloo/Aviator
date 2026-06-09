import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'CGU — Aviator' };

export default function TermsPage() {
  return (
    <LegalShell title="Conditions Générales d’Utilisation">
      <p>
        En accédant à Aviator (« le Service »), vous acceptez les présentes conditions. Si vous ne les
        acceptez pas, n’utilisez pas le Service.
      </p>

      <h2>1. Éligibilité</h2>
      <p>
        Vous devez avoir <b>18 ans révolus</b> (ou l’âge légal pour jouer dans votre juridiction, si supérieur)
        et résider dans un pays où les jeux d’argent en ligne sont autorisés. Il vous incombe de vérifier la
        légalité de votre participation. Le Service peut être interdit dans certains territoires.
      </p>

      <h2>2. Compte</h2>
      <p>
        Un seul compte par personne. Vous êtes responsable de la confidentialité de vos identifiants et de
        toute activité sur votre compte. Les informations fournies (nom, email, adresse) doivent être exactes ;
        de fausses informations peuvent entraîner la suspension du compte et le blocage des retraits.
      </p>

      <h2>3. Dépôts et retraits</h2>
      <p>
        Les dépôts et retraits s’effectuent en crypto-monnaie (USDT et autres). Les transactions sont
        irréversibles ; vérifiez l’adresse avant tout envoi. Les retraits peuvent faire l’objet d’une
        vérification de conformité (LCB-FT) avant validation. Des frais de réseau s’appliquent.
      </p>

      <h2>4. Déroulement du jeu</h2>
      <p>
        Le multiplicateur et le point de crash sont déterminés par le serveur. Les mises sont définitives une
        fois placées ; l’encaissement (« cash out ») doit intervenir avant le crash. Aucune garantie de gain
        n’est donnée — le jeu comporte un avantage maison.
      </p>

      <h2>5. Comportements interdits</h2>
      <p>
        Sont interdits : la fraude, l’utilisation de robots ou d’automatismes, l’exploitation de bugs, le
        blanchiment de capitaux, et la création de comptes multiples. Toute infraction peut entraîner la
        clôture du compte et la confiscation des soldes concernés.
      </p>

      <h2>6. Limitation de responsabilité</h2>
      <p>
        Le Service est fourni « en l’état ». Nous ne saurions être tenus responsables des pertes liées au jeu,
        aux interruptions techniques, à la volatilité des crypto-actifs ou à une mauvaise utilisation.
      </p>

      <h2>7. Jeu responsable</h2>
      <p>
        Le jeu peut créer une dépendance. Consultez notre page <a href="/responsible-gambling">Jeu responsable</a>{' '}
        pour les outils d’aide et de limitation.
      </p>

      <h2>8. Modifications et droit applicable</h2>
      <p>
        Nous pouvons modifier ces conditions à tout moment. La poursuite de l’utilisation vaut acceptation. Le
        droit applicable et la juridiction compétente sont ceux du pays de la licence d’exploitation.
      </p>
    </LegalShell>
  );
}
