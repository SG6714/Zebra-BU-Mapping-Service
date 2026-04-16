import { v4 as uuidv4 } from 'uuid';
import { HierarchyNode, IHierarchyNode, NodeType } from '../models/HierarchyNode';

export interface HierarchyPath {
  member_email: string;
  group?: Partial<IHierarchyNode> | null;
  team?: Partial<IHierarchyNode> | null;
  business_unit?: Partial<IHierarchyNode> | null;
  strategic_pillar?: Partial<IHierarchyNode> | null;
}

export interface AddNodeData {
  type: NodeType;
  name: string;
  leader_email: string;
  parent_id?: string | null;
}

function nodeToPlain(node: IHierarchyNode | null): Partial<IHierarchyNode> | null {
  if (!node) return null;
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    leader_email: node.leader_email,
    parent_id: node.parent_id,
    members: node.members,
  };
}

export async function getUserHierarchy(email: string): Promise<HierarchyPath | null> {
  // Sanitize to prevent NoSQL injection: ensure email is a plain string
  const safeEmail = String(email);

  // Find a node where the user is a member or a leader
  let startNode = await HierarchyNode.findOne({ 'members.email': safeEmail });

  if (!startNode) {
    startNode = await HierarchyNode.findOne({ leader_email: safeEmail });
  }

  if (!startNode) return null;

  const result: HierarchyPath = { member_email: safeEmail };

  // Place the starting node at its level
  const levelMap: Record<NodeType, keyof Omit<HierarchyPath, 'member_email'>> = {
    group: 'group',
    team: 'team',
    business_unit: 'business_unit',
    strategic_pillar: 'strategic_pillar',
  };

  result[levelMap[startNode.type]] = nodeToPlain(startNode);

  // Traverse up the tree
  let currentNode: IHierarchyNode | null = startNode;
  while (currentNode && currentNode.parent_id) {
    const parentNode: IHierarchyNode | null = await HierarchyNode.findOne({ id: currentNode.parent_id });
    if (!parentNode) break;
    result[levelMap[parentNode.type]] = nodeToPlain(parentNode);
    currentNode = parentNode;
  }

  return result;
}

export async function bulkGetUserHierarchy(emails: string[]): Promise<(HierarchyPath | null)[]> {
  return Promise.all(emails.map((email) => getUserHierarchy(email)));
}

export async function addNode(data: AddNodeData): Promise<IHierarchyNode> {
  const node = new HierarchyNode({
    id: uuidv4(),
    type: data.type,
    name: data.name,
    leader_email: data.leader_email,
    parent_id: data.parent_id || null,
    members: [],
  });
  return node.save();
}

export async function updateLeader(
  nodeId: string,
  leaderEmail: string
): Promise<IHierarchyNode | null> {
  // Sanitize to prevent NoSQL injection
  const safeNodeId = String(nodeId);
  const safeLeaderEmail = String(leaderEmail);
  return HierarchyNode.findOneAndUpdate(
    { id: safeNodeId },
    { leader_email: safeLeaderEmail },
    { new: true }
  );
}

export async function getNodesByType(type: NodeType): Promise<IHierarchyNode[]> {
  return HierarchyNode.find({ type });
}

export async function getNodeById(nodeId: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOne({ id: String(nodeId) });
}

export async function getAllNodes(): Promise<IHierarchyNode[]> {
  return HierarchyNode.find({}).sort({ type: 1, name: 1 });
}

export async function getUserMemberNode(email: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOne({ 'members.email': String(email) });
}

export async function addMemberToNode(nodeId: string, email: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOneAndUpdate(
    { id: String(nodeId) },
    { $addToSet: { members: { email: String(email) } } },
    { new: true }
  );
}

export async function removeMemberFromNode(nodeId: string, email: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOneAndUpdate(
    { id: String(nodeId) },
    { $pull: { members: { email: String(email) } } },
    { new: true }
  );
}

export async function updateNodeName(nodeId: string, name: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOneAndUpdate(
    { id: String(nodeId) },
    { name: String(name) },
    { new: true }
  );
}
