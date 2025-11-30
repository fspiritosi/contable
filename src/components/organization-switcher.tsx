'use client';

import { useState } from 'react';
import { switchOrganization } from '@/actions/organization-selector';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type Organization = {
    id: string;
    name: string;
    cuit: string;
};

export default function OrganizationSwitcher({
    organizations,
    activeOrgId
}: {
    organizations: Organization[];
    activeOrgId: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const activeOrg = organizations.find(org => org.id === activeOrgId);

    const handleSwitch = async (orgId: string) => {
        if (orgId === activeOrgId) {
            setIsOpen(false);
            return;
        }

        const loadingToast = toast.loading('Cambiando organización...');
        const res = await switchOrganization(orgId);
        toast.dismiss(loadingToast);

        if (res.success) {
            toast.success('Organización cambiada exitosamente');
            setIsOpen(false);
            window.location.reload(); // Force full reload to update all data
        } else {
            toast.error('Error al cambiar organización');
        }
    };

    if (organizations.length <= 1) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">{activeOrg?.name}</span>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">{activeOrg?.name}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                        {organizations.map((org) => (
                            <button
                                key={org.id}
                                onClick={() => handleSwitch(org.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-b-0"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium text-gray-900">{org.name}</span>
                                    <span className="text-xs text-gray-500">{org.cuit}</span>
                                </div>
                                {org.id === activeOrgId && (
                                    <Check className="h-4 w-4 text-green-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
