{
  description = "LUT Chainer — browser-based LUT chaining shader editor with WebGL preview";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs   = nixpkgs.legacyPackages.${system};
      nodejs = pkgs.nodejs_22;
    in {

      # ── Dev shell ────────────────────────────────────────────────────────
      # 使い方: nix develop
      devShells.${system}.default = pkgs.mkShell {
        name = "lutchainer";

        packages = [
          nodejs
          pkgs.esbuild   # CLIとしても使えるように
        ];

        shellHook = ''
          echo ""
          echo "  🐾  lutchainer dev shell (Node $(node --version))"
          echo ""
          echo "  npm install      — 依存関係のインストール"
          echo "  npm run build    — バンドル生成 (dist/bundle.js)"
          echo "  npm run dev      — ウォッチモード"
          echo "  npm run serve    — ローカルサーバ起動"
          echo "  npx tsc --noEmit — 型チェックのみ"
          echo ""
        '';
      };

      # ── Package (静的ファイルのビルド成果物) ─────────────────────────────
      # 使い方: nix build  →  result/ に index.html + dist/ が入る
      packages.${system}.default = pkgs.buildNpmPackage {
        pname   = "lutchainer";
        version = "1.0.0";

        src = ./.;

        nodejs = nodejs;

        # nix run nixpkgs#prefetch-npm-deps -- package-lock.json で再生成可能
        npmDepsHash = "sha256-cromly2A7uyOVCxcPZGRS97VUhEd4ittlhhSvB8G8Ss=";

        # postinstall に esbuild が走るのを防ぐ
        npmFlags = [ "--ignore-scripts" ];

        buildPhase = ''
          runHook preBuild
          npm run build
          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall
          mkdir -p $out
          cp index.html $out/
          cp -r dist     $out/dist
          runHook postInstall
        '';

        meta = {
          description = "Browser-based LUT chaining shader editor with WebGL preview";
          license     = pkgs.lib.licenses.cc0;
          mainProgram = "lutchainer";
        };
      };

      # ── App (nix run で簡易HTTPサーバを起動) ────────────────────────────
      # 使い方: nix run
      apps.${system}.default = {
        type    = "app";
        program = toString (pkgs.writeShellScript "serve-lutchainer" ''
          set -e
          DIST="${self.packages.${system}.default}"
          echo ""
          echo "  🐾  lutchainer → http://localhost:8000"
          echo "  Ctrl+C で停止"
          echo ""
          exec ${pkgs.nodejs}/bin/npm run serve --prefix "$DIST"
        '');
      };

    };
}
