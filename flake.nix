{
  description = "LUT Chainer — browser-based LUT chaining shader editor with WebGL preview";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ self, nixpkgs, flake-parts }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      
      perSystem = { config, self', pkgs, system, ... }:
        let
          nodejs = pkgs.nodejs_22;
          shaderRuntimeLibs = [
            pkgs.stdenv.cc.cc
            pkgs.libGL
            pkgs.mesa
            pkgs.libx11
            pkgs.libxi
            pkgs.libxext
            pkgs.libxrandr
            pkgs.libxdamage
            pkgs.libxinerama
          ];
        in {

          # nix develop
          devShells.default = pkgs.mkShell {
            name = "lutchainer";

            packages = [
              nodejs
              pkgs.esbuild   # CLI for bundling
              pkgs.python3   # Required for Agent's Skills
              pkgs.python3Packages.pyyaml

              # Native dependencies for shader validation
              pkgs.glslang
              pkgs.directx-shader-compiler

              # Native dependencies for headless-gl
              pkgs.pkg-config
              pkgs.xorg-server
            ];

            buildInputs = shaderRuntimeLibs;

            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath shaderRuntimeLibs;

            shellHook = ''
              echo ""
              echo "  🐾  lutchainer dev shell (Node $(node --version))"
              echo ""
              echo "  npm install      - Install deps"
              echo "  npm run build    - Bundle (dist/web + dist/cli)"
              echo "  npm run dev      - Watch mode"
              echo "  npm run serve    - Start local server"
              echo "  npm test         - Run CLI + shader tests"
              echo "  npm run test:shader:strict - Run glslang/dxc validation"
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
            npmDepsHash = "sha256-/NZ2zarhc6Wo87R6isk2I6A/ChBKO/1kceyUOZf0lYM=";

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

        };
    };
    }
