import styled from 'react-emotion';

export const Container = styled('div')`
  margin-top: auto;
  min-height: 68px;
  overflow-y: auto;
  width: 100%;
`;

export const ParkTaskListHeader = styled('div')`
  border-style: solid;
  border-width: 0 0 1px 0;
  display: flex;
  height: 24px;
  z-index: 1;
  position: relative;
  ${(props) => props.theme.TaskList.Filter.Container}
`;

export const ParkTaskListHeaderContent = styled('div')`
  margin-top: auto;
  margin-bottom: auto;
  padding: 0px 12px;
  width: 100%;
  white-space: nowrap;
  border: none;
  background: none;
  outline: none;
  text-align: left;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 2px;
  margin-right: auto;
  display: flex;
  align-items: center;
  width: auto;
  :hover,
  :focus {
      background: initial;
  }
  ${(props) => props.theme.TaskList.Filter.EntryButton}
`;

export const NoTasksContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-content: center;
  flex-direction: column;
  height: 44px;
  margin-left: 12px;
`;
