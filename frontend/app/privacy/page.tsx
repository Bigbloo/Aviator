import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Confidentialité — Aviator' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <p>
        Cette politique décrit les données que nous collectons et la manière dont nous les utilisons,
        conformément au RGPD et aux lois applicables.
      </p>

      <h2>1. Données collectées</h2>
      <p>
        Lors de l’inscription : pseudo, e-mail, nom, prénom, adresse postale. Lors de l’utilisation : adresse
        crypto de dépôt/retrait, historique des paris et transactions, adresse IP, données techniques
        (navigateur, appareil).
      </p>

      <h2>2. Finalités</h2>
      <p>
        Gestion du compte et du jeu, traitement des dépôts/retraits, prévention de la fraude et du blanchiment
        (LCB-FT), respect des obligations légales, et amélioration du Service.
      </p>

      <h2>3. Base légale</h2>
      <p>
        Exécution du contrat (fourniture du Service), obligations légales (conformité, lutte anti-blanchiment),
        et intérêt légitime (sécurité, prévention de la fraude).
      </p>

      <h2>4. Conservation</h2>
      <p>
        Les données sont conservées le temps de la relation contractuelle puis pendant la durée imposée par les
        obligations légales (notamment comptables et anti-blanchiment), puis supprimées ou anonymisées.
      </p>

      <h2>5. Partage</h2>
      <p>
        Vos données peuvent être partagées avec nos prestataires de paiement crypto et d’hébergement, et avec
        les autorités lorsque la loi l’exige. Nous ne vendons pas vos données.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité et
        d’opposition. Pour exercer ces droits, contactez-nous à l’adresse de support. Vous pouvez aussi saisir
        l’autorité de protection des données compétente.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Nous utilisons le stockage local (localStorage) pour la session de jeu, la confirmation d’âge et les
        préférences. Aucun cookie publicitaire tiers n’est requis pour le fonctionnement du Service.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Les mots de passe sont stockés hachés (bcrypt). Les accès administrateur et les retraits sont protégés.
        Aucun système n’étant infaillible, nous vous invitons à protéger vos identifiants.
      </p>
    </LegalShell>
  );
}
