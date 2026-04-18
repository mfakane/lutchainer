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
          shaderRuntimeLibs = with pkgs; [
            stdenv.cc.cc
            libGL
            mesa
            libx11
            libxi
            libxext
            libxrandr
            libxdamage
            libxinerama
          ];
          playwrightBrowserExecutable =
            if pkgs.stdenv.hostPlatform.isDarwin
            then "${pkgs.playwright-driver.browsers}/chromium-${chromium-rev}/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
            else "${pkgs.playwright-driver.browsers}/chromium-${chromium-rev}/chrome-linux64/chrome";
          browsers = (builtins.fromJSON (builtins.readFile "${pkgs.playwright-driver}/browsers.json")).browsers;
          chromium-rev = (builtins.head (builtins.filter (x: x.name == "chromium") browsers)).revision;
        in {

          # nix develop
          devShells.default = pkgs.mkShell {
            name = "lutchainer";

            packages = with pkgs; [
              nodejs
              esbuild   # CLI for bundling
              python3   # Required for Agent's Skills
              python3Packages.pyyaml

              # Native dependencies for shader validation
              glslang
              directx-shader-compiler

              # Native dependencies for headless-gl
              pkg-config
              xorg-server

              playwright-driver.browsers
              act
            ];

            buildInputs = shaderRuntimeLibs;

            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath shaderRuntimeLibs;

            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
              export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
              export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="${playwrightBrowserExecutable}"

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
            npmDepsHash = "sha256-5B9qrclkvVCizuRTkkqFejVT8CrBmRcuzmD/Bb0OGIE=";

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
