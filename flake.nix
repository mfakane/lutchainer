{
  description = "LUT Chainer — browser-based LUT chaining shader editor with WebGL preview";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodejs = pkgs.nodejs_22;
      in {

        # nix develop
        devShell = pkgs.mkShell {
          name = "lutchainer";

          packages = [
            nodejs
            pkgs.esbuild   # CLI for bundling
            pkgs.python3   # Required for Agent's Skills
            pkgs.python3Packages.pyyaml
          ];

          shellHook = ''
            echo ""
            echo "  🐾  lutchainer dev shell (Node $(node --version))"
            echo ""
            echo "  npm install      - Install deps"
            echo "  npm run build    - Bundle (dist/web + dist/cli)"
            echo "  npm run dev      - Watch mode"
            echo "  npm run serve    - Start local server"
            echo ""
          '';
        };

        # Package (static files + cli)
        # Usage: nix build -> dist/web and dist/cli placed in result/ 
        packages.default = pkgs.buildNpmPackage {
          pname   = "lutchainer";
          version = "1.0.0";

          src = ./.;

          nodejs = nodejs;

          # Regenerate with: nix run nixpkgs#prefetch-npm-deps -- package-lock.json
          npmDepsHash = "sha256-0V5AHXI+V3G1JuLZeEr3AtaSQVrDnASl8eGYxmGKMb4=";

          # Prevent esbuild from running during postinstall
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

        # nix run -- --help / nix run -- serve
        apps.default = {
          type    = "app";
          program = toString (pkgs.writeShellScript "lutchainer" ''
            set -e
            DIST="${self.packages.${system}.default}"
            exec ${pkgs.nodejs}/bin/node "$DIST/dist/cli/main.mjs" "$@"
          '');
        };

      });
}
