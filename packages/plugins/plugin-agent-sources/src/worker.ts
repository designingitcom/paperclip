import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { applyPlan, makePlan, configuredSources, selectSource, type Plan } from "./engine.js";
const plugin = definePlugin({
  async setup(ctx) {
    const plans = new Map<string, { userId: string; config: string; plan: Plan }>();
    ctx.actions.register("sources", async (_params, action) => {
      if (action.actor.type !== "user" || !action.actor.userId || !action.companyId) throw new Error("Select a company and sign in");
      const raw = await ctx.config.get(action.companyId);
      if (!raw.companyId || raw.companyId !== action.companyId) return [];
      const sources = configuredSources(raw);
      if (sources[0].companyId !== action.companyId) return [];
      return sources.map(({ agentId, agentName }) => ({ agentId, agentName }));
    });
    ctx.actions.register("check", async (params, action) => {
      if (action.actor.type !== "user" || !action.actor.userId || !action.companyId) throw new Error("Select the configured company and sign in as an authorized user");
      if (params.agentId !== undefined && typeof params.agentId !== "string") throw new Error("Invalid selected agent");
      const config = selectSource(await ctx.config.get(action.companyId), action.companyId, params.agentId as string | undefined);
      for (const [key, value] of plans) if (Date.parse(value.plan.expiresAt) < Date.now()) plans.delete(key);
      if (plans.size >= 10) throw new Error("Too many pending reviews. Wait for old reviews to expire.");
      const plan = await makePlan(config, ctx.agents.instructions);
      plans.set(plan.id, { userId: action.actor.userId, config: JSON.stringify(config), plan });
      return plan;
    });
    ctx.actions.register("sync", async (params, action) => {
      const stored = typeof params.planId === "string" ? plans.get(params.planId) : undefined;
      if (!stored || action.actor.type !== "user" || action.actor.userId !== stored.userId || action.companyId !== stored.plan.companyId) throw new Error("Review missing or belongs to another user/company. Check updates again.");
      if (params.reviewed !== true || !Array.isArray(params.selected) || params.selected.some(p => typeof p !== "string")) throw new Error("Review the selected changes before syncing");
      if (JSON.stringify(selectSource(await ctx.config.get(action.companyId), action.companyId, stored.plan.agentId)) !== stored.config) throw new Error("Source mapping changed. Check updates and review again.");
      plans.delete(stored.plan.id); // single use, including uncertain/partial outcomes
      const receipt = await applyPlan(stored.plan, params.selected as string[], ctx.agents.instructions);
      try {
        await ctx.state.set({ scopeKind: "company", scopeId: stored.plan.companyId, stateKey: `agent-sources:last-receipt:${stored.plan.agentId}` }, { ...receipt, userId: stored.userId, agentId: stored.plan.agentId });
      } catch { receipt.message += " Receipt persistence failed; retain this result before closing."; }
      return receipt;
    });
  },
});
export default plugin;
runWorker(plugin, import.meta.url);
