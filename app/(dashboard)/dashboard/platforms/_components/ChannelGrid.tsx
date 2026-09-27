"use client";

import { Plug } from "lucide-react";
import type { ChannelItem } from "@/components/integrations/ConfigureChannelModal";
import { ChannelCard } from "./ChannelCard";

interface ChannelGridProps {
    loading: boolean;
    filteredIntegrations: ChannelItem[];
    searchQuery: string;
    onConfigure: (item: ChannelItem) => void;
    onDisconnect: (item: ChannelItem) => void;
}

/**
 * Renders the connected channel cards grid with three states:
 * loading skeleton, empty state, and the actual card grid.
 */
export function ChannelGrid({
    loading,
    filteredIntegrations,
    searchQuery,
    onConfigure,
    onDisconnect,
}: ChannelGridProps) {
    // Loading skeleton state
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                    <div
                        key={n}
                        className="h-44 bg-card/60 animate-pulse border border-border/40 rounded-xl p-5"
                    />
                ))}
            </div>
        );
    }

    // Empty state
    if (filteredIntegrations.length === 0) {
        return (
            <div className="bg-card border border-border/60 rounded-2xl p-12 text-center space-y-3">
                <Plug className="w-10 h-10 mx-auto opacity-20 text-primary" />
                <h3 className="text-base font-bold text-foreground">No channels found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {searchQuery
                        ? "No channels match your search query. Try adjusting your search."
                        : 'No channel integrations connected for the selected bot filter. Click "Connect New Channel" to link your Meta or WhatsApp accounts.'}
                </p>
            </div>
        );
    }

    // Channel cards grid
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIntegrations.map((item) => (
                <ChannelCard
                    key={item.integrationId || item.id}
                    item={item}
                    onConfigure={onConfigure}
                    onDisconnect={onDisconnect}
                />
            ))}
        </div>
    );
}
