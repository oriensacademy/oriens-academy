import { SupabaseClient } from "@supabase/supabase-js";

export interface RequirementGroupNode {
  id?: string;
  name: string;
  logicalOperator: "AND" | "OR";
  children: RequirementGroupNode[];
  requirements: Array<{
    qualCode: string;
    status: string;
    gradeText?: string | null;
    minScore?: number | null;
    subjectName?: string | null;
  }>;
}

export class RuleGroupBuilder {
  constructor(private supabase: SupabaseClient) {}

  public async createGroup(
    programId: string,
    name: string,
    logicalOperator: "AND" | "OR" = "AND",
    parentGroupId?: string | null
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("admission_requirement_groups")
      .insert({
        program_id: programId,
        parent_group_id: parentGroupId || null,
        logical_operator: logicalOperator,
        name,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create requirement group: ${error?.message}`);
    }

    return data.id;
  }

  public renderRuleTreeASCII(root: RequirementGroupNode, indent: string = ""): string {
    let output = `${indent}└── [GROUP: ${root.logicalOperator}] ${root.name}\n`;
    const childIndent = indent + "    ";

    root.requirements.forEach((req, idx) => {
      const isLast = idx === root.requirements.length - 1 && root.children.length === 0;
      const prefix = isLast ? "└── " : "├── ";
      const scoreStr = req.minScore !== undefined && req.minScore !== null ? ` >= ${req.minScore}` : "";
      const gradeStr = req.gradeText ? ` (${req.gradeText})` : "";
      const subStr = req.subjectName ? ` in ${req.subjectName}` : "";

      output += `${childIndent}${prefix}[REQUIREMENT] ${req.qualCode}${subStr}${scoreStr}${gradeStr} (${req.status})\n`;
    });

    root.children.forEach((child) => {
      output += this.renderRuleTreeASCII(child, childIndent);
    });

    return output;
  }
}
