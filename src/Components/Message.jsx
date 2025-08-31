import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Message.css';

const socket = io('http://localhost:8000');

const Message = () => {
    const [username, setUsername] = useState('');
    const [currentMessage, setCurrentMessage] = useState('');
    const [messageList, setMessageList] = useState([]);
    const [messageToDelete, setMessageToDelete] = useState(null);

    useEffect(() => {
        socket.on('receive_message', (newMessage) => {
            setMessageList((prevList) => [...prevList, newMessage]);
        });

        return () => {
            socket.off('receive_message');
        };
    }, []);

    const sendMessage = () => {
        if (username.trim() !== '' && currentMessage.trim() !== '') {
            const messageData = {
                username,
                message: currentMessage,
                timestamp: new Date().toISOString(),
            };
            socket.emit('send_message', messageData);

            setUsername('');
            setCurrentMessage('');
        }
    };

    const handleDelete = () => {
        if (messageToDelete !== null) {
            setMessageList((prevList) => prevList.filter((_, i) => i !== messageToDelete));
            setMessageToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setMessageToDelete(null);
    };

    

    return (
        <div className="message-container">
            <div className="container">
                <div className="card">

                    <div className="card-header bg-primary text-white text-center">
                        <h3>
                            <i className="bi bi-whatsapp me-3"></i>
                            CONFABULATE
                            <i className="bi bi-whatsapp ms-3"></i>
                        </h3>
                    </div>

                    <div className="card-body" style={{ height: '350px', overflowY: 'auto' }}>
                        {messageList.map((msg, index) => {
                            const timeString = msg.timestamp
                                ? new Date(msg.timestamp).toLocaleTimeString()
                                : '';
                            const isParikshit = msg.username === 'Parikshit' || msg.username === 'parikshit';

                            return (
                                <div
                                    key={index}
                                    className={`mb-3 ${isParikshit ? 'text-end' : 'text-start'}`}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setMessageToDelete(index);
                                    }}
                                    style={{ cursor: 'context-menu' }}
                                >
                                    <div className={`fw-bold ${isParikshit ? 'text-end' : 'text-start'}`}>
                                        {msg.username}
                                    </div>
                                    <div className={isParikshit ? 'text-end' : 'text-start'}>
                                        {msg.message}
                                    </div>
                                    <div
                                        className={`text-muted ${isParikshit ? 'text-end' : 'text-start'}`}
                                        style={{ fontSize: '0.85rem' }}
                                    >
                                        {timeString}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="card-footer">
                        <div className="mb-2">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Your name..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{ width: '300px' }}
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Type a message..."
                                value={currentMessage}
                                onChange={(e) => setCurrentMessage(e.target.value)}
                                keyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        sendMessage();
                                    }
                                }}
                            />
                            <button className="btn btn-primary ms-3 rounded" onClick={sendMessage}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>

                {messageToDelete !== null && (
                    <div className="popup-container">
                        <div className="card popup-card">
                            <div className="card-body">
                                <p className="mb-4">Are you sure you want to delete this message?</p>
                                <div className="d-flex justify-content-end">
                                    <button className="btn btn-danger me-2" onClick={handleDelete}>
                                        YES
                                    </button>
                                    <button className="btn btn-secondary" onClick={handleCancelDelete}>
                                        NO
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;
