import './globals.css';

export const metadata = {
  title: 'FABRIK — Business Partner IA | Audit Digital 360°',
  description:
    'FABRIK analyse votre présence digitale en profondeur : site web, réseaux sociaux, et stratégie marketing. Obtenez votre audit 360° gratuit en quelques secondes.',
  keywords: 'audit digital, marketing, site web, instagram, performance, SEO, agence marketing',
  openGraph: {
    title: 'FABRIK — Audit Digital 360°',
    description: 'Analysez votre présence digitale complète en un clic.',
    siteName: 'FABRIK by Alsek',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
