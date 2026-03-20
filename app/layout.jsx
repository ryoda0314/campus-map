export const metadata = {
  title: "キャンパスマップエディタ",
  description: "大学キャンパスの案内ナビ地図データを編集",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: "#1a1a1f" }}>{children}</body>
    </html>
  );
}