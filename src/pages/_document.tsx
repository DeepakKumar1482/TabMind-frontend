import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" className="h-full antialiased">
      <Head />
      <body className="min-h-full flex flex-col">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
