import { SidebarControl } from "../../SidebarControl";
import { ChatPanelControl } from "../../TopBar/ChatPanelControl";
import { ContentHeader } from "./ContentHeader";
import { TabsContent } from "./TabsContent";
import { GroupStrip } from "./TabsContent/GroupStrip";

export function ContentView() {
	return (
		<div className="h-full flex flex-col overflow-hidden">
			<ContentHeader
				trailingAction={
					<div className="flex items-center gap-1">
						<ChatPanelControl />
						<SidebarControl />
					</div>
				}
			>
				<GroupStrip />
			</ContentHeader>
			<TabsContent />
		</div>
	);
}
