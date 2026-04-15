import mongoose, { Document, Schema } from 'mongoose';

export type NodeType = 'strategic_pillar' | 'business_unit' | 'team' | 'group';

export interface IMember {
  email: string;
}

export interface IHierarchyNode extends Document {
  id: string;
  type: NodeType;
  name: string;
  leader_email: string;
  parent_id?: string | null;
  members: IMember[];
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    email: { type: String, required: true },
  },
  { _id: false }
);

const HierarchyNodeSchema = new Schema<IHierarchyNode>(
  {
    id: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ['strategic_pillar', 'business_unit', 'team', 'group'],
    },
    name: { type: String, required: true },
    leader_email: { type: String, required: true },
    parent_id: { type: String, default: null },
    members: { type: [MemberSchema], default: [] },
  },
  { timestamps: true }
);

HierarchyNodeSchema.index({ type: 1 });
HierarchyNodeSchema.index({ parent_id: 1 });
HierarchyNodeSchema.index({ 'members.email': 1 });
HierarchyNodeSchema.index({ leader_email: 1 });

export const HierarchyNode = mongoose.model<IHierarchyNode>('HierarchyNode', HierarchyNodeSchema);
