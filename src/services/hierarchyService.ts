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
  // Find a node where the user is a member or a leader
  let startNode = await HierarchyNode.findOne({ 'members.email': email });

  if (!startNode) {
    startNode = await HierarchyNode.findOne({ leader_email: email });
  }

  if (!startNode) return null;

  const result: HierarchyPath = { member_email: email };

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
  return HierarchyNode.findOneAndUpdate(
    { id: nodeId },
    { leader_email: leaderEmail },
    { new: true }
  );
}

export async function getNodesByType(type: NodeType): Promise<IHierarchyNode[]> {
  return HierarchyNode.find({ type });
}

export async function getNodeById(nodeId: string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findOne({ id: nodeId });
}
