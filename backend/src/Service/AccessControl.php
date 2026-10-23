<?php
declare(strict_types=1);

namespace App\Service;

use Cake\ORM\Query\SelectQuery;

/**
 * Autorização central por papel e escopo.
 *
 * A identidade vem da sessão (array). Sessões antigas podem não ter `role`;
 * nesse caso o papel é derivado do campo `perfil`.
 */
class AccessControl
{
    public const ROLE_ADMIN = 'admin';
    public const ROLE_GESTOR = 'gestor';
    public const ROLE_CONSULTOR = 'consultor';

    /** @param array<string, mixed> $identity */
    public function roleFromIdentity(array $identity): string
    {
        $role = mb_strtolower(trim((string)($identity['role'] ?? '')));
        if (in_array($role, [self::ROLE_ADMIN, self::ROLE_GESTOR, self::ROLE_CONSULTOR], true)) {
            return $role;
        }

        $perfil = $this->normalizar((string)($identity['perfil'] ?? ''));
        if (str_contains($perfil, 'admin')) {
            return self::ROLE_ADMIN;
        }
        if (str_contains($perfil, 'gestor')) {
            return self::ROLE_GESTOR;
        }

        return self::ROLE_CONSULTOR;
    }

    /** @param array<string, mixed> $identity */
    public function isAdmin(array $identity): bool
    {
        return $this->roleFromIdentity($identity) === self::ROLE_ADMIN;
    }

    /** @param array<string, mixed> $identity */
    public function isManager(array $identity): bool
    {
        return in_array($this->roleFromIdentity($identity), [self::ROLE_ADMIN, self::ROLE_GESTOR], true);
    }

    /** @param array<string, mixed> $identity */
    public function canManageTeam(array $identity): bool
    {
        return $this->isAdmin($identity);
    }

    /** @param array<string, mixed> $identity */
    public function canManageCompany(array $identity): bool
    {
        return $this->isAdmin($identity);
    }

    /** @param array<string, mixed> $identity */
    public function canManageCatalog(array $identity): bool
    {
        return $this->isManager($identity);
    }

    /** @param array<string, mixed> $identity */
    public function canDeleteLead(array $identity): bool
    {
        return $this->isManager($identity);
    }

    public function leadScope(): string
    {
        $escopo = mb_strtolower(trim((string)env('AUTHZ_LEADS_SCOPE', 'own')));

        return in_array($escopo, ['all', 'own'], true) ? $escopo : 'own';
    }

    /** @param array<string, mixed> $identity */
    public function canSeeAllLeads(array $identity): bool
    {
        return $this->isManager($identity) || $this->leadScope() === 'all';
    }

    /** @param array<string, mixed> $identity */
    public function scopeLeads(SelectQuery $query, array $identity): SelectQuery
    {
        if (!$this->canSeeAllLeads($identity)) {
            $query->where(['Leads.responsavel' => (string)($identity['nome'] ?? '')]);
        }

        return $query;
    }

    /** @param array<string, mixed> $identity */
    public function scopeTasks(SelectQuery $query, array $identity): SelectQuery
    {
        if (!$this->canSeeAllLeads($identity)) {
            $query->where(['Tasks.responsavel' => (string)($identity['nome'] ?? '')]);
        }

        return $query;
    }

    /** @param array<string, mixed> $lead @param array<string, mixed> $identity */
    public function canAccessLead(array $lead, array $identity): bool
    {
        if ($this->canSeeAllLeads($identity)) {
            return true;
        }

        return (string)($lead['responsavel'] ?? '') === (string)($identity['nome'] ?? '');
    }

    /** @param array<string, mixed> $identity */
    public function scopeByResponsavel(array $identity, string $campo = 'responsavel'): array
    {
        if ($this->canSeeAllLeads($identity)) {
            return [];
        }

        return [$campo => (string)($identity['nome'] ?? '')];
    }

    private function normalizar(string $valor): string
    {
        $valor = trim(mb_strtolower($valor));
        if ($valor === '') {
            return '';
        }
        if (class_exists('Normalizer')) {
            $norm = \Normalizer::normalize($valor, \Normalizer::FORM_D);
            if ($norm !== false) {
                $valor = preg_replace('/\p{Mn}+/u', '', $norm) ?? $valor;
            }
        }

        return $valor;
    }
}
