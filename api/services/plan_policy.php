<?php

/** Regole server condivise; nessuna quota commerciale inventata. */
final class PlanPolicy
{
    public static function normalize(?string $plan): string
    {
        $plan = strtolower(trim($plan ?? ''));
        return $plan === 'agency' ? 'agency' : (in_array($plan, ['professional', 'pro'], true) ? 'professional' : 'base');
    }

    public static function siteLimit(?string $plan): int
    {
        // Agency non abilita ancora clienti illimitati: il modello futuro è distinto.
        return self::normalize($plan) === 'base' ? 1 : 3;
    }

    public static function connectors(?string $plan): bool
    {
        return self::normalize($plan) !== 'base';
    }
}
