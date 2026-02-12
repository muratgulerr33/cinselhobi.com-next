"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GlassContainer } from "@/components/ui/glass-container";
import { IconWrapper } from "@/components/ui/icon-wrapper";
import { Icons } from "@/components/ui/icons";

const ColorSwatch = ({
  name,
  bgVar,
  fgVar,
}: {
  name: string;
  bgVar: string;
  fgVar?: string;
}) => (
  <div className="space-y-2">
    <div
      className="h-20 w-full rounded-2xl border border-border p-4 flex items-center justify-center text-sm font-medium"
      style={{
        backgroundColor: `var(${bgVar})`,
        color: fgVar ? `var(${fgVar})` : "var(--foreground)",
      }}
    >
      {name}
    </div>
    <div className="text-xs text-muted-foreground font-mono">
      {bgVar}
      {fgVar && ` / ${fgVar}`}
    </div>
  </div>
);

export default function StyleguidePage() {
  const lightTokens = `:root {
  --radius: 0.65rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.586 0.253 17.585);
  --primary-foreground: oklch(0.969 0.015 12.422);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.712 0.194 13.428);
  --chart-1: oklch(0.81 0.117 11.638);
  --chart-2: oklch(0.645 0.246 16.439);
  --chart-3: oklch(0.586 0.253 17.585);
  --chart-4: oklch(0.514 0.222 16.935);
  --chart-5: oklch(0.455 0.188 13.697);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0.005 285.823);
  --sidebar-primary: oklch(0.586 0.253 17.585);
  --sidebar-primary-foreground: oklch(0.969 0.015 12.422);
  --sidebar-accent: oklch(0.967 0.001 286.375);
  --sidebar-accent-foreground: oklch(0.21 0.006 285.885);
  --sidebar-border: oklch(0.92 0.004 286.32);
  --sidebar-ring: oklch(0.712 0.194 13.428);
}`;

  const darkTokens = `.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.21 0.006 285.885);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.645 0.246 16.439);
  --primary-foreground: oklch(0.969 0.015 12.422);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.41 0.159 10.272);
  --chart-1: oklch(0.81 0.117 11.638);
  --chart-2: oklch(0.645 0.246 16.439);
  --chart-3: oklch(0.586 0.253 17.585);
  --chart-4: oklch(0.514 0.222 16.935);
  --chart-5: oklch(0.455 0.188 13.697);
  --sidebar: oklch(0.21 0.006 285.885);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.645 0.246 16.439);
  --sidebar-primary-foreground: oklch(0.969 0.015 12.422);
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.41 0.159 10.272);
}`;

  const longText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.`;

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Styleguide</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Tasarım sistemi kılavuzu - Tüm bileşenler, fontlar ve token&apos;lar
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Typography Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">Typography</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Font aileleri, başlık seviyeleri ve metin stilleri
          </p>
        </div>

        {/* Font Families */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Font Aileleri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 p-4 border border-border rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">Geist Sans</div>
              <div className="text-2xl font-sans" style={{ fontFamily: "var(--font-geist-sans)" }}>
                The quick brown fox jumps over the lazy dog
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                --font-geist-sans
              </div>
            </div>
            <div className="space-y-2 p-4 border border-border rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">Geist Mono</div>
              <div className="text-2xl font-mono" style={{ fontFamily: "var(--font-geist-mono)" }}>
                The quick brown fox jumps over the lazy dog
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                --font-geist-mono
              </div>
            </div>
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Başlık Seviyeleri</h3>
          <div className="space-y-6 p-6 border border-border rounded-lg">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-foreground">Heading 1</h1>
              <div className="text-xs text-muted-foreground font-mono">text-5xl font-bold</div>
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-bold text-foreground">Heading 2</h2>
              <div className="text-xs text-muted-foreground font-mono">text-4xl font-bold</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-semibold text-foreground">Heading 3</h3>
              <div className="text-xs text-muted-foreground font-mono">text-3xl font-semibold</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-2xl font-semibold text-foreground">Heading 4</h4>
              <div className="text-xs text-muted-foreground font-mono">text-2xl font-semibold</div>
            </div>
            <div className="space-y-2">
              <h5 className="text-xl font-medium text-foreground">Heading 5</h5>
              <div className="text-xs text-muted-foreground font-mono">text-xl font-medium</div>
            </div>
          </div>
        </div>

        {/* Font Sizes */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Font Boyutları</h3>
          <div className="space-y-3 p-6 border border-border rounded-lg">
            <div className="space-y-1">
              <div className="text-xs text-foreground">text-xs (12px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-xs</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-foreground">text-sm (14px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-sm</div>
            </div>
            <div className="space-y-1">
              <div className="text-base text-foreground">text-base (16px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-base</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg text-foreground">text-lg (18px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-lg</div>
            </div>
            <div className="space-y-1">
              <div className="text-xl text-foreground">text-xl (20px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-xl</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl text-foreground">text-2xl (24px)</div>
              <div className="text-xs text-muted-foreground font-mono">text-2xl</div>
            </div>
          </div>
        </div>

        {/* Font Weights */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Font Ağırlıkları</h3>
          <div className="space-y-3 p-6 border border-border rounded-lg">
            <div className="space-y-1">
              <div className="font-light text-foreground">font-light (300)</div>
              <div className="text-xs text-muted-foreground font-mono">font-light</div>
            </div>
            <div className="space-y-1">
              <div className="font-normal text-foreground">font-normal (400)</div>
              <div className="text-xs text-muted-foreground font-mono">font-normal</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">font-medium (500)</div>
              <div className="text-xs text-muted-foreground font-mono">font-medium</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-foreground">font-semibold (600)</div>
              <div className="text-xs text-muted-foreground font-mono">font-semibold</div>
            </div>
            <div className="space-y-1">
              <div className="font-bold text-foreground">font-bold (700)</div>
              <div className="text-xs text-muted-foreground font-mono">font-bold</div>
            </div>
          </div>
        </div>

        {/* Long Text */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Uzun Metin Örneği</h3>
          <div className="p-6 border border-border rounded-lg space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Paragraf (text-base)</div>
              <p className="text-base leading-relaxed text-foreground">{longText}</p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Küçük Metin (text-sm)</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{longText.substring(0, 200)}...</p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Çok Küçük Metin (text-xs)</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{longText.substring(0, 150)}...</p>
            </div>
          </div>
        </div>
      </section>

      {/* Buttons Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">Buttons</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm button variant&apos;ları ve boyutları
          </p>
        </div>

        {/* Button Variants */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Variant&apos;lar</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              variant: default | secondary | destructive | outline | ghost | link
            </div>
          </div>
        </div>

        {/* Button Sizes */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Boyutlar</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Icons.search className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              size: sm | default | lg | icon
            </div>
          </div>
        </div>

        {/* Button States */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Durumlar</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <div className="flex flex-wrap gap-3 items-center">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button pressable>Pressable</Button>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              disabled | pressable (active:scale-95)
            </div>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">Badges</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm badge variant&apos;ları
          </p>
        </div>

        <div className="space-y-4 p-6 border border-border rounded-lg">
          <div className="flex flex-wrap gap-3 items-center">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            variant: default | secondary | destructive | outline | success | warning | info
          </div>
        </div>
      </section>

      {/* UI Components Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">UI Components</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Avatar, IconWrapper, GlassContainer ve diğer bileşenler
          </p>
        </div>

        {/* Avatar */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Avatar</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <div className="flex flex-wrap gap-4 items-center">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="Avatar" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>
                  <Icons.user className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-16 w-16">
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* IconWrapper */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">IconWrapper</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <div className="flex flex-wrap gap-3 items-center">
              <IconWrapper aria-label="Search">
                <Icons.search className="w-5 h-5" />
              </IconWrapper>
              <IconWrapper aria-label="Cart">
                <Icons.cart className="w-5 h-5" />
              </IconWrapper>
              <IconWrapper aria-label="Heart">
                <Icons.heart className="w-5 h-5" />
              </IconWrapper>
              <IconWrapper aria-label="User" disabled>
                <Icons.user className="w-5 h-5" />
              </IconWrapper>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Minimum 44x44px touch target (w-11 h-11)
            </div>
          </div>
        </div>

        {/* GlassContainer */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">GlassContainer</h3>
          <div className="space-y-4 p-6 border border-border rounded-lg">
            <GlassContainer className="p-6">
              <p className="text-sm text-foreground">
                GlassContainer bileşeni - bg-background/80 backdrop-blur-md
              </p>
            </GlassContainer>
            <GlassContainer rounded="none" className="p-6">
              <p className="text-sm text-foreground">
                rounded=&quot;none&quot; variant
              </p>
            </GlassContainer>
            <div className="text-xs text-muted-foreground font-mono">
              rounded: &quot;none&quot; | &quot;lg&quot; (default: &quot;lg&quot;)
            </div>
          </div>
        </div>
      </section>

      {/* Theme Tokens Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">Theme Tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Renk token&apos;ları ve CSS değişkenleri
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">
              Pairs (with foreground)
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ColorSwatch
                name="Primary"
                bgVar="--primary"
                fgVar="--primary-foreground"
              />
              <ColorSwatch
                name="Secondary"
                bgVar="--secondary"
                fgVar="--secondary-foreground"
              />
              <ColorSwatch
                name="Accent"
                bgVar="--accent"
                fgVar="--accent-foreground"
              />
              <ColorSwatch
                name="Card"
                bgVar="--card"
                fgVar="--card-foreground"
              />
              <ColorSwatch
                name="Popover"
                bgVar="--popover"
                fgVar="--popover-foreground"
              />
              <ColorSwatch
                name="Muted"
                bgVar="--muted"
                fgVar="--muted-foreground"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">
              Standalone
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ColorSwatch name="Background" bgVar="--background" />
              <ColorSwatch name="Foreground" bgVar="--foreground" />
              <ColorSwatch name="Destructive" bgVar="--destructive" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">
              Border / Input / Ring
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ColorSwatch name="Border" bgVar="--border" />
              <ColorSwatch name="Input" bgVar="--input" />
              <ColorSwatch name="Ring" bgVar="--ring" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Chart</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <ColorSwatch name="Chart 1" bgVar="--chart-1" />
              <ColorSwatch name="Chart 2" bgVar="--chart-2" />
              <ColorSwatch name="Chart 3" bgVar="--chart-3" />
              <ColorSwatch name="Chart 4" bgVar="--chart-4" />
              <ColorSwatch name="Chart 5" bgVar="--chart-5" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Sidebar</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ColorSwatch
                name="Sidebar"
                bgVar="--sidebar"
                fgVar="--sidebar-foreground"
              />
              <ColorSwatch
                name="Sidebar Primary"
                bgVar="--sidebar-primary"
                fgVar="--sidebar-primary-foreground"
              />
              <ColorSwatch
                name="Sidebar Accent"
                bgVar="--sidebar-accent"
                fgVar="--sidebar-accent-foreground"
              />
              <ColorSwatch name="Sidebar Border" bgVar="--sidebar-border" />
              <ColorSwatch name="Sidebar Ring" bgVar="--sidebar-ring" />
            </div>
          </div>
        </div>
      </section>

      {/* Token Blocks Section */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-3xl font-bold text-foreground">Token Blocks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            CSS değişkenleri ve token tanımları
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Light (:root)
            </h3>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-4 text-xs text-card-foreground">
              {lightTokens}
            </pre>
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Dark (.dark)
            </h3>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-4 text-xs text-card-foreground">
              {darkTokens}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
