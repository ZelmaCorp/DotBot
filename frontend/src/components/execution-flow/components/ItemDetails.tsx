/**
 * Item Details Component
 * 
 * Displays expandable details for an execution item
 */

import React from 'react';
import { ExecutionItem } from '@dotbot/core/executionEngine/types';
import {
  WarningsSection,
  MetadataSection,
  ErrorSection,
  ResultSection,
  ExecutingIndicator
} from './detailSections';

export interface ItemDetailsProps {
  item: ExecutionItem;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ item }) => {
  const isItemExecuting =
    item.status === 'executing' ||
    item.status === 'signing' ||
    item.status === 'broadcasting' ||
    item.status === 'in_block';
  const isItemCompleted = item.status === 'completed' || item.status === 'finalized';
  const isItemFailed = item.status === 'failed';

  return (
    <div className="execution-item-details">
      <WarningsSection warnings={item.warnings} />
      <MetadataSection metadata={item.metadata} />
      <ErrorSection item={item} isItemFailed={isItemFailed} />
      <ResultSection item={item} isItemCompleted={isItemCompleted} />
      <ExecutingIndicator isItemExecuting={isItemExecuting} status={item.status} />
    </div>
  );
};

export default ItemDetails;
