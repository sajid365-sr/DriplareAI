"use client";

import type { UseInboxStateReturn } from "./useInboxState";

import { LiveInboxHeader } from "../../chatbots/[chatbotId]/activity/_components/live-inbox-header";
import { SessionList } from "../../chatbots/[chatbotId]/activity/_components/session-list";
import { ConversationPanel } from "../../chatbots/[chatbotId]/activity/_components/conversation-panel";
import { CrmPanel } from "../../chatbots/[chatbotId]/activity/_components/crm-panel";

type InboxState = UseInboxStateReturn;

interface InboxLayoutProps {
    state: InboxState;
}

/**
 * Responsive 3-column layout for the Global Live Inbox:
 * - Column 1: Session List (sidebar)
 * - Column 2: Conversation Thread (main)
 * - Column 3: CRM Panel (right sidebar, desktop only)
 *
 * On mobile, views are toggled via `mobileView` state.
 */
export function InboxLayout({ state }: InboxLayoutProps) {
    const {
        sessions,
        filteredSessions,
        loadingSessions,
        selectedSession,
        activeSessionData,
        messages,
        loadingMessages,
        filter,
        setFilter,
        activeStatusTab,
        integrationStatus,
        platforms,
        searchQuery,
        setSearchQuery,
        selectedSessionIds,
        setSelectedSessionIds,
        isSendingMessage,
        chatbotId,
        mobileView,
        setMobileView,
        statusCounts,
        handleStatusTabChange,
        handleSelectSession,
        fetchSessions,
        seedDemoChats,
        deleteSession,
        deleteSelectedSessions,
        toggleSessionStatus,
        toggleArchiveSession,
        archiveSelectedSessions,
        updateLeadStatus,
        sendHumanMessage,
        formatShortDate,
        downloadSession,
        messagesEndRef,
    } = state;

    return (
        <>
            {/* Top Filter Header Bar */}
            <LiveInboxHeader
                activeChannel={filter}
                onChannelChange={setFilter}
                activeStatusTab={activeStatusTab}
                onStatusTabChange={handleStatusTabChange}
                statusCounts={statusCounts}
                mobileView={mobileView}
                onMobileBack={() => setMobileView(mobileView === "crm" ? "chat" : "list")}
            />

            {/* ── Responsive Live Inbox Main Layout ── */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-background/50">
                {/* Column 1: Session List */}
                <div
                    className={`
            ${mobileView === "list" ? "flex" : "hidden"}
            md:flex
            w-full md:w-[300px] lg:w-[330px] md:shrink-0
            flex-col h-full
            md:border-r md:border-border/40
          `}
                >
                    <div className="flex-1 overflow-hidden p-2 md:p-0">
                        <SessionList
                            sessions={sessions}
                            filteredSessions={filteredSessions}
                            loadingSessions={loadingSessions}
                            selectedSession={selectedSession}
                            onSelectSession={handleSelectSession}
                            onRefresh={fetchSessions}
                            filter={filter}
                            onFilterChange={setFilter}
                            activeStatusTab={activeStatusTab}
                            integrationStatus={integrationStatus}
                            platforms={platforms}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            selectedSessionIds={selectedSessionIds}
                            onToggleSelectSession={(id) =>
                                setSelectedSessionIds((prev) =>
                                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                                )
                            }
                            onSelectAllSessions={(checked) =>
                                setSelectedSessionIds(checked ? filteredSessions.map((s) => s.sessionId) : [])
                            }
                            onDeleteSelectedSessions={deleteSelectedSessions}
                            onArchiveSelectedSessions={archiveSelectedSessions}
                            onToggleSessionStatus={toggleSessionStatus}
                            onToggleArchiveSession={toggleArchiveSession}
                            onSeedDemoChats={seedDemoChats}
                        />
                    </div>
                </div>

                {/* Column 2: Conversation Thread */}
                <div
                    className={`
            ${mobileView === "chat" ? "flex" : "hidden"}
            md:flex
            flex-1 min-w-0 flex-col h-full
            p-2 md:p-0
          `}
                >
                    {/* Mobile: Show CRM button in chat view */}
                    {selectedSession && (
                        <div className="flex lg:hidden justify-end px-2 pt-1 pb-0 shrink-0">
                            <button
                                onClick={() => setMobileView("crm")}
                                className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-lg"
                            >
                                View CRM →
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden md:p-2 lg:p-0">
                        <ConversationPanel
                            selectedSession={selectedSession}
                            messages={messages}
                            loadingMessages={loadingMessages}
                            activeSessionData={activeSessionData}
                            onDelete={deleteSession}
                            onDownload={downloadSession}
                            onToggleStatus={toggleSessionStatus}
                            onToggleArchive={toggleArchiveSession}
                            onSendHumanMessage={sendHumanMessage}
                            isSendingMessage={isSendingMessage}
                            formatShortDate={formatShortDate}
                            messagesEndRef={messagesEndRef}
                        />
                    </div>
                </div>

                {/* Column 3: CRM Panel */}
                <div
                    className={`
            ${mobileView === "crm" ? "flex" : "hidden"}
            lg:flex
            w-full lg:w-[300px] xl:w-[320px] lg:shrink-0
            flex-col h-full
            p-2 lg:p-0
          `}
                >
                    <CrmPanel
                        session={activeSessionData}
                        messages={messages}
                        chatbotId={chatbotId}
                        onUpdateLeadStatus={updateLeadStatus}
                    />
                </div>
            </div>
        </>
    );
}
