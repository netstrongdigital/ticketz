import React, { useContext, useState } from "react";
import {
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
} from "@material-ui/core";

import { useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";

import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "calc(100% - 58px)",
    overflow: "hidden",
    borderRadius: 0,
    //backgroundColor: "inherit",
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  listItem: {
    cursor: "pointer",
  },
}));

export default function ChatList({
  chats,
  handleSelectChat,
  handleDeleteChat,
  handleEditChat,
  handleLeaveChat,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState({});
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedChatToLeave, setSelectedChatToLeave] = useState({});

  const { id } = useParams();

  const isParticipant = (chat) => {
    if (!chat || !Array.isArray(chat.users)) return false;
    return chat.users.some((u) => {
      try {
        return (
          u.userId === user.id ||
          (u.user && u.user.id === user.id) ||
          u.id === user.id
        );
      } catch (err) {
        return false;
      }
    });
  };

  const goToMessages = async (chat) => {
    if (unreadMessages(chat) > 0) {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {}
    }

    if (id !== chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
      handleSelectChat(chat);
    }
  };

  const handleDelete = () => {
    handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat) => {
    if (!chat || !Array.isArray(chat.users)) return 0;
    const currentUser = chat.users.find((u) => {
      try {
        return (
          u.userId === user.id ||
          (u.user && u.user.id === user.id) ||
          u.id === user.id
        );
      } catch (err) {
        return false;
      }
    });
    return currentUser ? currentUser.unreads : 0;
  };

  const getPrimaryText = (chat) => {
    const mainText = chat.title;
    const unreads = unreadMessages(chat);
    return (
      <>
        {mainText}
        {unreads > 0 && (
          <Chip
            size="small"
            style={{ marginLeft: 5 }}
            label={unreads}
            color="secondary"
          />
        )}
      </>
    );
  };

  const getSecondaryText = (chat) => {
    return chat.lastMessage !== ""
      ? `${datetimeToClient(chat.updatedAt)}: ${chat.lastMessage}`
      : "";
  };

  const getItemStyle = (chat) => {
    return {
      borderLeft: chat.uuid === id ? "6px solid #002d6e" : null,
     // backgroundColor: chat.uuid === id ? "#eee" : null,
    };
  };

  return (
    <>
      <ConfirmationModal
        title={"Excluir Conversa"}
        open={confirmationModal}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        Esta ação não pode ser revertida, confirmar?
      </ConfirmationModal>
      <div className={classes.mainContainer}>
        <div className={classes.chatList}>
          <List>
            {Array.isArray(chats) &&
              chats.length > 0 &&
              chats.map((chat, key) => (
                <ListItem
                  onClick={() => goToMessages(chat)}
                  key={key}
                  className={classes.listItem}
                  style={getItemStyle(chat)}
                  button
                >
                  <ListItemText
                    primary={getPrimaryText(chat)}
                    secondary={getSecondaryText(chat)}
                  />
                  {
                    /* Render actions: Leave visible to any participant (non-owner). Edit/Delete only for owner or admin. */
                  }
                  {(isParticipant(chat) && chat.ownerId !== user.id) ||
                  chat.ownerId === user.id ||
                  user.profile === "admin" ? (
                    <ListItemSecondaryAction>
                      {/* Leave button: show for participants who are NOT the owner */}
                      {isParticipant(chat) && chat.ownerId !== user.id && (
                        <IconButton
                          onClick={() => {
                            setSelectedChatToLeave(chat);
                            setLeaveModalOpen(true);
                          }}
                          edge="end"
                          aria-label="leave"
                          size="small"
                          style={{ marginRight: 5 }}
                        >
                          {/* explicit exit icon for leaving the chat */}
                          <ExitToAppIcon />
                        </IconButton>
                      )}

                      {/* Edit/Delete: only for owner or admin */}
                      {(chat.ownerId === user.id || user.profile === "admin") && (
                        <>
                          <IconButton
                            onClick={() => {
                              goToMessages(chat).then(() => {
                                handleEditChat(chat);
                              });
                            }}
                            edge="end"
                            aria-label="edit"
                            size="small"
                            style={{ marginRight: 5 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => {
                              setSelectedChat(chat);
                              setConfirmModalOpen(true);
                            }}
                            edge="end"
                            aria-label="delete"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </ListItemSecondaryAction>
                  ) : null}
                </ListItem>
              ))}
          </List>
        </div>
      </div>
      <ConfirmationModal
        title={"Sair da Conversa"}
        open={leaveModalOpen}
        onClose={setLeaveModalOpen}
        onConfirm={() => {
          setLeaveModalOpen(false);
          if (selectedChatToLeave && handleLeaveChat) handleLeaveChat(selectedChatToLeave);
        }}
      >
        Você tem certeza que deseja sair desta conversa?
      </ConfirmationModal>
    </>
  );
}
