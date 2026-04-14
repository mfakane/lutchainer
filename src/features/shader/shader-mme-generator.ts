import { buildGeneratedShaderHeader } from '../../shared/build-info.ts';
import {
  resolveStepRuntimeModels,
} from '../step/step-runtime.ts';
import {
  buildCustomUniformComments,
  buildSampleBody,
  collectUsedCustomParams,
} from './shader-generator-utils.ts';
import type {
  ShaderBuildInput,
  ShaderGenerator,
  ShaderGeneratorCapabilities,
} from './shader-generator.ts';
import { buildShaderLocalDeclarations } from './shader-local-decls.ts';
import { MME_SHADER_BACKEND } from './shader-mme-backend.ts';
import { buildShaderStepCode } from './shader-step-code.ts';

const MME_GENERATOR_CAPABILITIES: ShaderGeneratorCapabilities = {
  fragment: true,
  previewFragment: false,
  vertex: false,
};

function buildHlslSampleBody(luts: ShaderBuildInput['luts']): string {
  return buildSampleBody(
    luts,
    'float4(1.0, 1.0, 1.0, 1.0)',
    index => `tex2D(sampler_${index}, uv)`,
  );
}

function buildSharedColorFunctions(): string {
  return `float4 RgbToHsv(float3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  float maxValue = max(r, max(g, b));
  float minValue = min(r, min(g, b));
  float delta = maxValue - minValue;

  float hue = 0.0;
  if (delta > 1.0e-6) {
    if (maxValue <= r) {
      hue = ((g - b) / delta + (g < b ? 6.0 : 0.0)) / 6.0;
    } else if (maxValue <= g) {
      hue = ((b - r) / delta + 2.0) / 6.0;
    } else if (maxValue <= b) {
      hue = ((r - g) / delta + 4.0) / 6.0;
    }
  }

  float saturation = maxValue <= 1.0e-6 ? 0.0 : delta / maxValue;
  float value = maxValue;
  float hasChroma = step(1.0e-6, delta);
  return saturate(float4(hue, saturation, value, hasChroma));
}

float3 HsvToRgb(float4 color) {
  float saturation = saturate(color.y);
  float value = saturate(color.z);
  float hasChroma = clamp(color.w, 0.0, 1.0);

  if (saturation <= 1.0e-6 || hasChroma <= 1.0e-6) {
    return float3(value, value, value);
  }

  float hue = color.x - floor(color.x);
  float c = value * saturation;
  float x = c * (1.0 - abs(fmod(hue * 6.0, 2.0) - 1.0));
  float m = value - c;
  float cM = c + m;
  float xM = x + m;

  float sectorFloat = floor(hue * 6.0);
  int sector = int(fmod(sectorFloat, 6.0));

  if (sector == 0) return float3(cM, xM, m);
  if (sector == 1) return float3(xM, cM, m);
  if (sector == 2) return float3(m, cM, xM);
  if (sector == 3) return float3(m, xM, cM);
  if (sector == 4) return float3(xM, m, cM);
  return float3(cM, m, xM);
}`;
}

function buildTextureDeclarations(
  texture: {
    type: string,
    variableName: string,
    semantic?: string,
    annotation?: string,
  },
  sampler: {
    variableName: string,
    filter: 'LINEAR' | 'POINT' | 'ANISOTROPIC',
    mipFilter?: 'NONE',
    addressU?: 'CLAMP',
    addressV?: 'CLAMP',
    maxAnisotropy?: number,
  }
): string {
  return [
    `${texture.type} ${texture.variableName}${texture.semantic ? ` : ${texture.semantic}` : ''}${texture.annotation ? ` < ${texture.annotation} >` : ''};`,
    `sampler ${sampler.variableName} = sampler_state`,
    `{`,
    `  Texture = <${texture.variableName}>;`,
    `  MinFilter = ${sampler.filter};`,
    `  MagFilter = ${sampler.filter};`,
    sampler.mipFilter ? `  MipFilter = ${sampler.mipFilter};` : '',
    sampler.addressU ? `  AddressU = ${sampler.addressU};` : '',
    sampler.addressV ? `  AddressV = ${sampler.addressV};` : '',
    sampler.maxAnisotropy ? `  MaxAnisotropy = ${sampler.maxAnisotropy};` : '',
    `};`,
  ].filter(Boolean).join('\n');
}

function buildLutTextureDeclaration(model: ShaderBuildInput['luts'][number], index: number): string {
  return buildTextureDeclarations(
    {
      type: 'texture2D',
      variableName: `texture_${index}`,
      annotation: `string ResourceName = "${model.id}.png"`,
    },
    {
      variableName: `sampler_${index}`,
      filter: 'ANISOTROPIC',
      addressU: 'CLAMP',
      addressV: 'CLAMP',
      maxAnisotropy: 16,
    }
  );
}

function buildCustomParamDeclaration(param: ShaderBuildInput['customParams'][number]): string {
  return [
    `float u_param_${param.id} <`,
    `  string UIName = "${param.label}";`,
    `  string UIHelp = "カスタムパラメータ ${param.label} の値を指定します。";`,
    `  string UIWidget = "Slider";`,
    `  float UIMin = 0;`,
    `  float UIMax = 1;`,
    `> = ${param.defaultValue};`,
  ].join('\n');
}

function buildFragmentShader(input: ShaderBuildInput): string {
  const textureDecl = input.luts.map(buildLutTextureDeclaration).join('\n');
  const usedCustomParams = collectUsedCustomParams(input.steps, input.customParams);
  const customUniformComments = buildCustomUniformComments(usedCustomParams);
  const sampleBody = buildHlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, {
    backend: MME_SHADER_BACKEND,
    isPreview: false,
  });
  const localDeclarations = buildShaderLocalDeclarations(stepModels, {
    backend: MME_SHADER_BACKEND,
    outputKind: 'fragment',
    material: input.materialSettings,
  });

  return `${buildGeneratedShaderHeader('//')}
${usedCustomParams.map(buildCustomParamDeclaration).join('\n')}
${textureDecl}

${customUniformComments ? `${customUniformComments}\n` : ''}

float FresnelStrength
<
  string UIName = "Fresnel Strength";
  string UIHelp = "フレネル反射の強さを調整します。0 でフレネル反射なし、1 で通常のフレネル反射の強さになります。";
  string UIWidget = "Slider";
  float UIMin = 0;
  float UIMax = 1;
> = 0.1;

float FresnelPower
<
  string UIName = "Fresnel Power";
  string UIHelp = "フレネル反射の鋭さを調整します。値が大きいほど、フレネル反射がより鋭くなります。";
  string UIWidget = "Slider";
  float UIMin = 0.01;
  float UIMax = 10;
> = 2.0;

////////////////////////////////////////////////////////////////////////////////
// MikuMikuMoving Compatibility Layer
////////////////////////////////////////////////////////////////////////////////

#ifdef MIKUMIKUMOVING

int   voffset   : VERTEXINDEXOFFSET;
float EdgeWidth : EDGEWIDTH;

#define ADDINGSPHERETEXTURE ADDINGSPHERE
#define MULTIPLYINGSPHERETEXTURE MULTIPLYINGSPHERE

#define Compat_SkinnedPosition(IN) MMM_SkinnedPosition(IN.Pos, IN.BlendWeight, IN.BlendIndices, IN.SdefC, IN.SdefR0, IN.SdefR1)
#define Compat_SkinnedPositionNormal(IN) MMM_SkinnedPositionNormal(IN.Pos, IN.Normal, IN.BlendWeight, IN.BlendIndices, IN.SdefC, IN.SdefR0, IN.SdefR1)
#define Compat_LightAt(Array, Index) Array[Index]

float4 Compat_GetSelfShadowUV(float4 Position, float4x4 WorldMatrix, float4x4 LightWorldViewProjMatrix, float3 LightPosition, float LightZFar)
{
    float4 dPos = mul(Position, WorldMatrix);
    float4 UV = mul(dPos, LightWorldViewProjMatrix);

    UV.y = -UV.y;
    UV.z = length(LightPosition - Position.xyz) - LightZFar;

    return UV;
}

#else

// MMD のシャドウバッファ
sampler __ShadowSampler : register(s0);

struct MMM_SKINNING_INPUT
{
    float4 Pos    : POSITION;
    float2 Tex    : TEXCOORD0;
    float4 AddUV1 : TEXCOORD1;
    float4 AddUV2 : TEXCOORD2;
    float4 AddUV3 : TEXCOORD3;
    float3 Normal : NORMAL;
    int    Index  : _INDEX;
};

struct MMM_SKINNING_OUTPUT
{
    float4 Position;
    float2 __Reserved_Tex;
    float3 Normal;
};

const int   voffset = 0;
const float EdgeWidth = 1;
const bool  MMM_IsDinamicProjection = false;
bool parthf; // パースペクティブフラグ

float4x4 __LIGHTWVPMATRICES0    : WORLDVIEWPROJECTION < string Object = "Light"; >;
float3   __LIGHTDIRECTIONS0     : DIRECTION < string Object = "Light"; >;
float3   __LIGHTDIFFUSECOLORS0  : DIFFUSE < string Object = "Light"; >;
float3   __LIGHTAMBIENTCOLORS0  : AMBIENT < string Object = "Light"; >;
float3   __LIGHTSPECULARCOLORS0 : SPECULAR < string Object = "Light"; >;
float3   __LIGHTPOSITIONS0      : POSITION < string Object = "Light"; >;
static bool  __LIGHTENABLES0 = true;
static float __LIGHTZFARS0 = 1;

#define MMM_LightCount 1

// MMD に最適化するための定数
#define SKII1 1500
#define SKII2 8000
#define Toon 3

#define ADDINGSPHERE ADDINGSPHERETEXTURE
#define MULTIPLYINGSPHERE MULTIPLYINGSPHERETEXTURE

#define Compat_SkinnedPosition(IN) (IN.Pos)
#define Compat_LightArrayValue(MMMSemantic) { __##MMMSemantic##0 }
#define Compat_LightAt(Array, Index) Array[0]
#define MMM_DynamicFov(ProjMatrix, Length) (ProjMatrix)

MMM_SKINNING_OUTPUT Compat_SkinnedPositionNormal(MMM_SKINNING_INPUT IN)
{
    MMM_SKINNING_OUTPUT SkinOut = (MMM_SKINNING_OUTPUT)0;
    SkinOut.Position = IN.Pos;
    SkinOut.Normal = IN.Normal;
    return SkinOut;
}

float MMD_GetSelfShadowValue(float3 Normal, float4 ZCalcTex, uniform bool isPerspective)
{
    ZCalcTex /= ZCalcTex.w;
    float2 TransTexCoord = 0.5 + ZCalcTex.xy * float2(0.5, -0.5);

    if (any(saturate(TransTexCoord) != TransTexCoord))
    {
        // シャドウバッファ外
        return 1;
    }
    else
    {
        float comp = max(ZCalcTex.z - tex2D(__ShadowSampler, TransTexCoord).r, 0.0f);

        if (isPerspective)
        {
            // セルフシャドウ mode2
            comp *= SKII2 * TransTexCoord.y - 0.3f;
        }
        else
        {
            // セルフシャドウ mode1
            comp *= SKII1 - 0.3f;
        }

        return 1 - saturate(comp);
    }
}

float3 MMM_GetToonColor(float4 MaterialToon, float3 Normal, float3 LightDirection0, float3 LightDirection1, float3 LightDirection2)
{
    float LightNormal = dot(Normal, -LightDirection0);
    
    return lerp(MaterialToon.rgb, 1, saturate(LightNormal * Toon));
}

float3 MMM_GetSelfShadowToonColor(float4 MaterialToon, float3 Normal, float4 LightUV1, float4 LightUV2, float4 LightUV3, uniform bool useSoftShadow, uniform bool useToon)
{
    float ShadowValue = MMD_GetSelfShadowValue(Normal, LightUV1, parthf);

    return useToon ? lerp(MaterialToon.rgb, 1, ShadowValue) : ShadowValue;
}

float4 Compat_GetSelfShadowUV(float4 Position, float4x4 WorldMatrix, float4x4 LightWorldViewProjMatrix, float3 LightPosition, float LightZFar)
{
    return mul(Position, LightWorldViewProjMatrix);
}

#endif

////////////////////////////////////////////////////////////////////////////////
// General Input Parameters
////////////////////////////////////////////////////////////////////////////////

// 座標変換行列
float4x4 WorldViewProjMatrix : WORLDVIEWPROJECTION;
float4x4 WorldMatrix         : WORLD;
float4x4 ViewMatrix          : VIEW;
float4x4 ProjMatrix          : PROJECTION;

//材質モーフ関連
float4   AddingTexture   : ADDINGTEXTURE;      // 材質モーフ加算 Texture 値
float4   AddingSphere    : ADDINGSPHERE;       // 材質モーフ加算 SphereTexture 値
float4   MultiplyTexture : MULTIPLYINGTEXTURE; // 材質モーフ乗算 Texture 値
float4   MultiplySphere  : MULTIPLYINGSPHERE;  // 材質モーフ乗算 SphereTexture 値

//カメラ位置
float3   CameraPosition : POSITION < string Object = "Camera"; >;

// マテリアル色
float4   MaterialDiffuse   : DIFFUSE < string Object = "Geometry"; >;
float3   MaterialAmbient   : AMBIENT < string Object = "Geometry"; >;
float3   MaterialEmmisive  : EMISSIVE < string Object = "Geometry"; >;
float3   MaterialSpecular  : SPECULAR < string Object = "Geometry"; >;
float    SpecularPower     : SPECULARPOWER < string Object = "Geometry"; >;
float4   MaterialToon      : TOONCOLOR;

bool     spadd;                    // スフィアマップ加算合成フラグ
bool     usetoontexturemap = true; // Toon テクスチャフラグ
bool     use_subtexture;           // サブテクスチャフラグ

// ライト関連
#ifdef MIKUMIKUMOVING

bool     LightEnables[MMM_LightCount]     : LIGHTENABLES;
float4x4 LightWVPMatrices[MMM_LightCount] : LIGHTWVPMATRICES;
float3   LightDirections[MMM_LightCount]  : LIGHTDIRECTIONS;

float3   LightDiffuses[MMM_LightCount]    : LIGHTDIFFUSECOLORS;
float3   LightAmbients[MMM_LightCount]    : LIGHTAMBIENTCOLORS;
float3   LightSpeculars[MMM_LightCount]   : LIGHTSPECULARCOLORS;
float3   LightPositions[MMM_LightCount]   : LIGHTPOSITIONS;
float    LightZFars[MMM_LightCount]       : LIGHTZFARS;

#else

static bool     LightEnables[MMM_LightCount]     = Compat_LightArrayValue(LIGHTENABLES);
static float4x4 LightWVPMatrices[MMM_LightCount] = Compat_LightArrayValue(LIGHTWVPMATRICES);
static float3   LightDirections[MMM_LightCount]  = Compat_LightArrayValue(LIGHTDIRECTIONS);

static float3   LightDiffuses[MMM_LightCount]    = Compat_LightArrayValue(LIGHTDIFFUSECOLORS);
static float3   LightAmbients[MMM_LightCount]    = Compat_LightArrayValue(LIGHTAMBIENTCOLORS);
static float3   LightSpeculars[MMM_LightCount]   = Compat_LightArrayValue(LIGHTSPECULARCOLORS);
static float3   LightPositions[MMM_LightCount]   = Compat_LightArrayValue(LIGHTPOSITIONS);
static float    LightZFars[MMM_LightCount]       = Compat_LightArrayValue(LIGHTZFARS);

#endif

// ライト色
static float4 DiffuseColor[3] =
{
  MaterialDiffuse * float4(Compat_LightAt(LightDiffuses, 0), 1.0f),
  MaterialDiffuse * float4(Compat_LightAt(LightDiffuses, 1), 1.0f),
  MaterialDiffuse * float4(Compat_LightAt(LightDiffuses, 2), 1.0f)
};
static float3 AmbientColor[3] =
{
  saturate(MaterialAmbient * Compat_LightAt(LightAmbients, 0)) + MaterialEmmisive,
  saturate(MaterialAmbient * Compat_LightAt(LightAmbients, 1)) + MaterialEmmisive,
  saturate(MaterialAmbient * Compat_LightAt(LightAmbients, 2)) + MaterialEmmisive
};
static float3 SpecularColor[3] =
{
  MaterialSpecular * Compat_LightAt(LightSpeculars, 0),
  MaterialSpecular * Compat_LightAt(LightSpeculars, 1),
  MaterialSpecular * Compat_LightAt(LightSpeculars, 2)
};

${buildTextureDeclarations(
  {
    type: 'texture',
    variableName: 'ObjectTexture',
    semantic: 'MATERIALTEXTURE',
  },
  {
    variableName: 'ObjectTextureSampler',
    filter: 'LINEAR',
  }
)}
${buildTextureDeclarations(
  {
    type: 'texture',
    variableName: 'ObjectSphereMap',
    semantic: 'MATERIALSPHEREMAP',
  },
  {
    variableName: 'ObjectSphereSampler',
    filter: 'LINEAR',
  }
)}
${buildTextureDeclarations(
  {
    type: 'texture',
    variableName: 'ObjectToonTexture',
    semantic: 'MATERIALTOONTEXTURE',
  },
  {
    variableName: 'ObjectToonSampler',
    filter: 'LINEAR',
    mipFilter: 'NONE',
    addressU: 'CLAMP',
    addressV: 'CLAMP',
  }
)}

////////////////////////////////////////////////////////////////////////////////
// Main Code
////////////////////////////////////////////////////////////////////////////////

struct VS_OUTPUT
{
  float4 Pos    : POSITION;  // 射影変換座標
  float2 Tex    : TEXCOORD0; // テクスチャ
  float4 SubTex : TEXCOORD1; // サブテクスチャ/スフィアマップ
  float3 Normal : TEXCOORD2; // 法線
  float3 Eye    : TEXCOORD3; // カメラとの相対位置
  float4 SS_UV1 : TEXCOORD5; // セルフシャドウテクスチャ座標
  float4 SS_UV2 : TEXCOORD6; // セルフシャドウテクスチャ座標
  float4 SS_UV3 : TEXCOORD7; // セルフシャドウテクスチャ座標
  float4 Color  : COLOR0;    // ライトによる色
};

${buildSharedColorFunctions()}

float4 SampleLut(int lutIndex, float2 uv) {
  uv = saturate(uv);
  ${sampleBody}
}

VS_OUTPUT Basic_VS(MMM_SKINNING_INPUT IN, uniform bool useSphereMap, uniform bool useSelfShadow)
{
  MMM_SKINNING_OUTPUT SkinOut = Compat_SkinnedPositionNormal(IN);
  VS_OUTPUT Out = (VS_OUTPUT)0;
  Out.Eye = CameraPosition - mul(SkinOut.Position, WorldMatrix).xyz;
  Out.Normal = normalize(mul(SkinOut.Normal, (float3x3)WorldMatrix));

  // Vertex Position
  if (MMM_IsDinamicProjection)
  {
    float4x4 dWorldViewProjMatrix = mul(mul(WorldMatrix, ViewMatrix), MMM_DynamicFov(ProjMatrix, length(Out.Eye)));
    Out.Pos = mul(SkinOut.Position, dWorldViewProjMatrix);
  }
  else
  {
    Out.Pos = mul(SkinOut.Position, WorldViewProjMatrix);
  }

  // Diffuse + Ambient Calculation
  float3 TotalDiffuse = 0;
  float3 TotalAmbient = 0;
  float  TotalCount = 0;

  [unroll]
  for (int light = 0; light < MMM_LightCount; light++)
  {
    if (LightEnables[light])
    {
      TotalDiffuse += (float3(1, 1, 1) - TotalDiffuse) * (max(0, DiffuseColor[light].rgb * dot(Out.Normal, -LightDirections[light])));
      TotalAmbient += AmbientColor[light];
      TotalCount += 1;
    }
  }

  Out.Color = float4(saturate(TotalAmbient / TotalCount + TotalDiffuse), MaterialDiffuse.a);

  // Texture Coords
  Out.Tex = IN.Tex;
  Out.SubTex.xy = IN.AddUV1.xy;

  if (useSphereMap)
  {
    if (use_subtexture)
    {
      Out.SubTex.zw = IN.AddUV1.xy;
    }
    else
    {
      float2 NormalWV = mul(Out.Normal, (float3x3)ViewMatrix).xy;
      Out.SubTex.z = NormalWV.x * 0.5f + 0.5f;
      Out.SubTex.w = NormalWV.y * -0.5f + 0.5f;
    }
  }

  if (useSelfShadow)
  {
    Out.SS_UV1 = Compat_GetSelfShadowUV(SkinOut.Position, WorldMatrix, Compat_LightAt(LightWVPMatrices, 0), Compat_LightAt(LightPositions, 0), Compat_LightAt(LightZFars, 0));
    Out.SS_UV2 = Compat_GetSelfShadowUV(SkinOut.Position, WorldMatrix, Compat_LightAt(LightWVPMatrices, 1), Compat_LightAt(LightPositions, 1), Compat_LightAt(LightZFars, 1));
    Out.SS_UV3 = Compat_GetSelfShadowUV(SkinOut.Position, WorldMatrix, Compat_LightAt(LightWVPMatrices, 2), Compat_LightAt(LightPositions, 2), Compat_LightAt(LightZFars, 2));
  }

  return Out;
}

float4 Basic_PS(VS_OUTPUT IN, uniform bool useTexture, uniform bool useSphereMap, uniform bool useToon, uniform bool useSelfShadow) : COLOR0
{
  float4 OutColor = IN.Color;
  float  TexAlpha = MultiplyTexture.a + AddingTexture.a;

  if (useTexture)
  {
    float4 TexColor = tex2D(ObjectTextureSampler, IN.Tex);

    TexColor.rgb = (TexColor.rgb * MultiplyTexture.rgb + AddingTexture.rgb) * TexAlpha + (1 - TexAlpha);
    OutColor *= TexColor;
  }

  if (useSphereMap)
  {
    float4 TexColor = tex2D(ObjectSphereSampler, IN.SubTex.zw);

    TexColor.rgb = spadd
      ? TexColor.rgb * MultiplySphere.rgb + AddingSphere.rgb
      : TexColor.rgb * MultiplySphere.rgb + AddingSphere.rgb;

    if (spadd)
    {
      OutColor.rgb += TexColor.rgb;
    }
    else
    {
      OutColor.rgb *= TexColor.rgb;
    }

    OutColor.a *= TexColor.a;
  }

  float ShadowValue = 1;

  if (useToon && usetoontexturemap)
  {
    ShadowValue = MMM_GetToonColor(0, IN.Normal, Compat_LightAt(LightDirections, 0), Compat_LightAt(LightDirections, 1), Compat_LightAt(LightDirections, 2)).r;
  }

  if (useSelfShadow)
  {
    float SelfShadow = MMM_GetSelfShadowToonColor(0, IN.Normal, IN.SS_UV1, IN.SS_UV2, IN.SS_UV3, false, useToon).r;
    ShadowValue = min(ShadowValue, SelfShadow);
  }

  float3 Diffuse = 0;
  int lightCount = 0;

  [unroll]
  for (int i = 0; i < MMM_LightCount; i++)
    if (LightEnables[i])
    {
      float3 LightDirection = LightDirections[i];

      ${localDeclarations.join('\n      ')}
      float3 color = OutColor.rgb;

      ${stepCode.join('\n      ')}

      Diffuse += color;
      lightCount++;
    }

  OutColor.rgb = saturate(Diffuse / lightCount);

  return OutColor;
}

////////////////////////////////////////////////////////////////////////////////
// Technique Variations
////////////////////////////////////////////////////////////////////////////////

// TECHNIQUE NAMING CONVENTION
// ---------------------------
//
// The technique names are composed of the following parts in order:
//
// 1. Base name: "Object"
// 2. Optional "Tx" if UseTexture is true
// 3. Optional "Sp" if UseSphereMap is true
// 4. Optional "Tn" if UseToon is true
// 5. Optional "Ss" if useSelfShadow is true
//
// In other words, the technique name is constructed as following pattern:
//
//                                 +-useSelfShadow---------------------+
//                  +-useToon------|----------------+                  |
//     Object       | ObjectTn     | ObjectTnSs     | ObjectSs         |
// +-useTexture-----|--------------|----------------|--------------+   |
// |   ObjectTx     | ObjectTxTn   | ObjectTxTnSs   | ObjectTxSs   |   |
// | +-useSphereMap-|--------------|----------------|--------------|-+ |
// | | ObjectTxSp   | ObjectTxSpTn | ObjectTxSpTnSs | ObjectTxSpSs | | |
// +-|--------------|--------------|----------------|--------------+ | |
//   | ObjectSp     | ObjectSpTn   | ObjectSpTnSs   | ObjectSpSs     | |
//   |              |              +----------------|----------------|-+
//   |              +-------------------------------+                |
//   +---------------------------------------------------------------+

technique Object < string MMDPass = "object"; bool UseTexture = false; bool UseSphereMap = false; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, false);
    PixelShader = compile ps_3_0 Basic_PS(false, false, false, false);
  }
}

technique ObjectSs < string MMDPass = "object_ss"; bool UseTexture = false; bool UseSphereMap = false; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, true);
    PixelShader = compile ps_3_0 Basic_PS(false, false, false, true);
  }
}

technique ObjectSp < string MMDPass = "object"; bool UseTexture = false; bool UseSphereMap = true; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, false);
    PixelShader = compile ps_3_0 Basic_PS(false, true, false, false);
  }
}

technique ObjectSpSs < string MMDPass = "object_ss"; bool UseTexture = false; bool UseSphereMap = true; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, true);
    PixelShader = compile ps_3_0 Basic_PS(false, true, false, true);
  }
}

technique ObjectTx < string MMDPass = "object"; bool UseTexture = true; bool UseSphereMap = false; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, false);
    PixelShader = compile ps_3_0 Basic_PS(true, false, false, false);
  }
}

technique ObjectTxSs < string MMDPass = "object_ss"; bool UseTexture = true; bool UseSphereMap = false; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, true);
    PixelShader = compile ps_3_0 Basic_PS(true, false, false, true);
  }
}

technique ObjectTxSp < string MMDPass = "object"; bool UseTexture = true; bool UseSphereMap = true; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, false);
    PixelShader = compile ps_3_0 Basic_PS(true, true, false, false);
  }
}

technique ObjectTxSpSs < string MMDPass = "object_ss"; bool UseTexture = true; bool UseSphereMap = true; bool UseToon = false; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, true);
    PixelShader = compile ps_3_0 Basic_PS(true, true, false, true);
  }
}

technique ObjectTn < string MMDPass = "object"; bool UseTexture = false; bool UseSphereMap = false; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, false);
    PixelShader = compile ps_3_0 Basic_PS(false, false, true, false);
  }
}

technique ObjectTnSs < string MMDPass = "object_ss"; bool UseTexture = false; bool UseSphereMap = false; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, true);
    PixelShader = compile ps_3_0 Basic_PS(false, false, true, true);
  }
}

technique ObjectSpTn < string MMDPass = "object"; bool UseTexture = false; bool UseSphereMap = true; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, false);
    PixelShader = compile ps_3_0 Basic_PS(false, true, true, false);
  }
}

technique ObjectSpTnSs < string MMDPass = "object_ss"; bool UseTexture = false; bool UseSphereMap = true; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, true);
    PixelShader = compile ps_3_0 Basic_PS(false, true, true, true);
  }
}

technique ObjectTxTn < string MMDPass = "object"; bool UseTexture = true; bool UseSphereMap = false; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, false);
    PixelShader = compile ps_3_0 Basic_PS(true, false, true, false);
  }
}

technique ObjectTxTnSs < string MMDPass = "object_ss"; bool UseTexture = true; bool UseSphereMap = false; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(false, true);
    PixelShader = compile ps_3_0 Basic_PS(true, false, true, true);
  }
}

technique ObjectTxSpTn < string MMDPass = "object"; bool UseTexture = true; bool UseSphereMap = true; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, false);
    PixelShader = compile ps_3_0 Basic_PS(true, true, true, false);
  }
}

technique ObjectTxSpTnSs < string MMDPass = "object_ss"; bool UseTexture = true; bool UseSphereMap = true; bool UseToon = true; >
{
  pass DrawObject
  {
    VertexShader = compile vs_3_0 Basic_VS(true, true);
    PixelShader = compile ps_3_0 Basic_PS(true, true, true, true);
  }
}`;
}

export const MME_SHADER_GENERATOR: ShaderGenerator = {
  language: 'mme',
  displayName: 'MMEffect',
  capabilities: MME_GENERATOR_CAPABILITIES,
  buildFragment: buildFragmentShader,
  getExportFiles(input: ShaderBuildInput): Record<string, string> {
    return {
      'shader.fx': buildFragmentShader(input),
    };
  },
};
