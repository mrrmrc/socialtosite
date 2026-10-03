import { t } from '@/lib/i18n'
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useConfigStore } from '@/store/configStore'
import type { ThemeConfig } from '@/blocks/types'
import { themePresets, resolveTheme, googleFontOptions } from '@/lib/theme-presets'

function ColorInput({ value, onInput, onChange }: { value: string; onInput: (v: string) => void; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-border-default bg-bg-2 cursor-pointer p-0.5 shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
        }}
        onBlur={(e) => {
          const v = e.target.value
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
        }}
        className="w-[100px] px-1.5 py-1 rounded border border-border-default bg-bg-2 text-text-1 text-[15px] font-mono outline-none focus:border-green"
      />
    </div>
  )
}

function ColorSection({ title, colors, defaultOpen = false }: {
  title: string
  colors: { key: keyof ThemeConfig; label: string }[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const theme = useConfigStore((s) => s.config.theme)
  const previewTheme = useConfigStore((s) => s.previewTheme)
  const updateTheme = useConfigStore((s) => s.updateTheme)
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-2 hover:bg-bg-3 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{t(title)}</span>
          <div className="flex gap-0.5">
            {colors.slice(0, 4).map((c) => (
              <div
                key={c.key}
                className="w-3 h-3 rounded-sm border border-border-subtle"
                style={{ backgroundColor: resolved[c.key] as string }}
              />
            ))}
          </div>
        </div>
        <ChevronDown size={12} className={`text-text-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-2.5 bg-bg-1">
          {colors.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] text-text-2">{t(c.label)}</span>
              <ColorInput
                value={resolved[c.key] as string}
                onInput={(v) => previewTheme({ [c.key]: v })}
                onChange={(v) => updateTheme({ [c.key]: v })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DesignPanel() {
  const theme = useConfigStore((s) => s.config.theme)
  const setTheme = useConfigStore((s) => s.setTheme)
  const updateTheme = useConfigStore((s) => s.updateTheme)
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  const activePresetId = useMemo(() => {
    for (const preset of themePresets) {
      const match = Object.keys(preset.theme).every(
        (k) => resolved[k as keyof ThemeConfig] === preset.theme[k as keyof ThemeConfig]
      )
      if (match) return preset.id
    }
    return null
  }, [resolved])

  return (
    <div className="px-3.5 py-3.5">
      <Link to="/themes" className="block border border-green rounded-lg p-3 mb-4 text-green font-semibold">{t('Themes and layouts')} →</Link>
      {/* Preset grid */}
      <div className="mb-4">
        <div className="text-[15px] font-semibold uppercase tracking-wider text-text-3 mb-2">{t("Presets")}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {themePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setTheme(preset.theme)}
              className={`p-2 rounded-lg border transition-all text-left ${
                activePresetId === preset.id
                  ? 'border-green bg-green/5'
                  : 'border-border-default bg-bg-2 hover:border-border-hover hover:bg-bg-3'
              }`}
            >
              <div className="flex gap-0.5 mb-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.bg0 }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.bg2 }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.accent }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.text0 }} />
              </div>
              <div className="text-[15px] font-medium truncate">{t(preset.name)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Color sections */}
      <div className="space-y-2 mb-4">
        <ColorSection
          title={t("Backgrounds")}
          defaultOpen
          colors={[
            { key: 'bg0', label: t('Base') },
            { key: 'bg1', label: t('Surface 1') },
            { key: 'bg2', label: t('Surface 2') },
            { key: 'bg3', label: t('Surface 3') },
            { key: 'bg4', label: t('Surface 4') },
            { key: 'bg5', label: t('Surface 5') },
          ]}
        />
        <ColorSection
          title={t("Text")}
          colors={[
            { key: 'text0', label: t('Primary') },
            { key: 'text1', label: t('Secondary') },
            { key: 'text2', label: t('Muted') },
            { key: 'text3', label: t('Dimmed') },
          ]}
        />
        <ColorSection
          title={t("Accent")}
          defaultOpen
          colors={[
            { key: 'accent', label: t('Accent') },
            { key: 'accentDim', label: t('Accent Dim') },
          ]}
        />
        <ColorSection
          title={t("Borders")}
          colors={[
            { key: 'borderDefault', label: t('Default') },
            { key: 'borderSubtle', label: t('Subtle') },
            { key: 'borderHover', label: t('Hover') },
          ]}
        />
      </div>

      {/* Fonts */}
      <div className="mb-4">
        <div className="text-[15px] font-semibold uppercase tracking-wider text-text-3 mb-2">{t("Fonts")}</div>
        <div className="space-y-2.5">
          {([
            { key: 'fontSans' as const, label: t('Body') },
            { key: 'fontDisplay' as const, label: t('Display') },
            { key: 'fontMono' as const, label: t('Mono') },
          ]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[15px] text-text-2 mb-1">{t(label)}</label>
              <select
                value={resolved[key]}
                onChange={(e) => updateTheme({ [key]: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green cursor-pointer"
                style={{ fontFamily: `"${resolved[key]}", sans-serif` }}
              >
                {googleFontOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div>
        <div className="text-[15px] font-semibold uppercase tracking-wider text-text-3 mb-2">{t("Radius")}</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[15px] text-text-2 mb-1">{t("Default")}</label>
            <input
              type="number"
              min={0}
              max={24}
              value={resolved.radius}
              onChange={(e) => updateTheme({ radius: Number(e.target.value) })}
              className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block text-[15px] text-text-2 mb-1">{t("Large")}</label>
            <input
              type="number"
              min={0}
              max={32}
              value={resolved.radiusLg}
              onChange={(e) => updateTheme({ radiusLg: Number(e.target.value) })}
              className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
