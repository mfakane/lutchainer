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
          pkgs.python3   # Agent の Skills 関連で必要
          pkgs.python3Packages.pyyaml
        ];

        shellHook = ''
          echo ""
          echo "  🐾  lutchainer dev shell (Node $(node --version))"
          echo ""
          echo "  npm install      — 依存関係のインストール"
          echo "  npm run build    — バンドル生成 (dist/web + dist/cli)"
          echo "  npm run dev      — ウォッチモード"
          echo "  npm run serve    — ローカルサーバ起動"
          echo "  npx tsc --noEmit — 型チェックのみ"
          echo ""
        '';
      };

      # ── Package (静的ファイル + CLI) ───────────────────────────────────
      # 使い方: nix build  →  result/ に dist/web と dist/cli が入る
      packages.${system}.default = pkgs.buildNpmPackage {
        pname   = "lutchainer";
        version = "1.0.0";

        src = ./.;

        nodejs = nodejs;

        # nix run nixpkgs#prefetch-npm-deps -- package-lock.json で再生成可能
        npmDepsHash = "sha256-0V5AHXI+V3G1JuLZeEr3AtaSQVrDnASl8eGYxmGKMb4=";

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
          cp package.json $out/
          cp -r dist      $out/dist
          runHook postInstall
        '';

        meta = {
          description = "Browser-based LUT chaining shader editor with WebGL preview";
          license     = pkgs.lib.licenses.cc0;
          mainProgram = "lutchainer";
        };
      };

      # ── App (nix run で CLI を起動) ────────────────────────────
      # 使い方: nix run -- --help / nix run -- serve
      apps.${system}.default = {
        type    = "app";
        program = toString (pkgs.writeShellScript "lutchainer" ''
          set -e
          DIST="${self.packages.${system}.default}"
          exec ${pkgs.nodejs}/bin/node "$DIST/dist/cli/main.mjs" "$@"
        '');
      };

    };
}
