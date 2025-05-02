console.log('WhatsApp Spam Tool content script starting...');

chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);

    const whatsAppOperations = new WhatsAppUtils();
    const isSendingInProgress = whatsAppOperations.isSendingInProgress;

    if (request.action === "sendMessages") {
        if (isSendingInProgress) {
            sendResponse({ 
                status: "error", 
                message: "Previous sending operation is still in progress" 
            });
            return true;
        }

        // sendMessage(request.message, request.count, sendResponse);
        whatsAppOperations.sendMessage(request.message, request.count, request.contact, sendResponse);
        return true;
    }
});

class WhatsAppUtils {
    
    isSendingInProgress = false;

    async waitForElementAndFind(selector, timeout = 5000) {
        const element = await new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) {
                resolve(el);
                return;
            }
    
            const startTime = Date.now();
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                } else if (Date.now() - startTime >= timeout) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 100);
        });
    
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }
    
        return element;
    }

    
    simulateMouseEvents(element, eventName) {
        const mouseEvent = document.
            createEvent('MouseEvents');
        mouseEvent.
            initEvent(eventName, true, true);
        element.
            dispatchEvent(mouseEvent);
    }

    async selectChat(contactName) {
        try {
            let element = await this.waitForElementAndFind('[title="' + contactName + '"]');
            if (!element) throw new Error("Contact not found");
            this.simulateMouseEvents(element, 'mousedown');
            return true;

        } catch( error) {
            console.error('Error select chat:', error);
            return false;
        }
    }

    writeMessage(element, text) {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });
    
        element.dispatchEvent(pasteEvent);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async writeAndSendMessage(message) {
        try {
            const messageBox = await this.waitForElementAndFind('div[contenteditable="true"][data-tab="10"]');
            if (!messageBox) {
                throw new Error("Message box not found");
            }
    
            messageBox.textContent = '';
            messageBox.focus();
    
            this.writeMessage(messageBox, message);
            
            // await new Promise(resolve => setTimeout(resolve, 100));
            await this.waitFor(0.1);
    
            const sendButton = document.querySelector('span[data-icon="send"]');
            if (!sendButton || !sendButton.parentElement) {
                return false;
            }
    
            sendButton.parentElement.click();
            // await new Promise(resolve => setTimeout(resolve, 750));
            await this.waitFor(0.75)
    
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
    
    async sendMessage(message, repeatCount, contactName, sendResponse) {
        if (this.isSendingInProgress) {
            sendResponse({ 
                status: "error", 
                message: "Previous sending operation is still in progress" 
            });
            return;
        }

        let successCount = 0;
        let failCount = 0;
        this.isSendingInProgress = true;

        const isChatSelected = await this.selectChat(contactName);
        if(!isChatSelected) {
            
            chrome.runtime.sendMessage({
                status: "complete",
                success: successCount,
                failed: failCount
            });
            return;
        }
    
        for (let i = 0; i < repeatCount && this.isSendingInProgress; i++) {
            console.log(`Sending message ${i + 1}/${repeatCount}...`);
            
            const success = await this.writeAndSendMessage(message);
            
            if (success) {
                successCount++;
                chrome.runtime.sendMessage({
                    status: "progress",
                    current: i + 1,
                    total: repeatCount,
                    success: successCount,
                    failed: failCount
                });
                console.log(`Message ${i + 1}/${repeatCount} sent`);
            } else {
                failCount++;
                chrome.runtime.sendMessage({
                    status: "progress",
                    current: i + 1,
                    total: repeatCount,
                    success: successCount,
                    failed: failCount
                });
                console.error(`Failed to send message ${i + 1}/${repeatCount}`);
            }
    
            if (i < repeatCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    
        this.isSendingInProgress = false;
        chrome.runtime.sendMessage({
            status: "complete",
            success: successCount,
            failed: failCount
        });
    }

    waitFor(second) {
        return new Promise(resolve => setTimeout(resolve, second * 1000));
    }
    
}
