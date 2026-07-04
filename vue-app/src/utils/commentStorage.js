const STORAGE_KEY = "usedchang-comments";

function readComments() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeComments(comments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
}

export function getCommentsByPostId(postId) {
  return readComments().filter(comment => comment.postId === postId);
}

export function createComment(postId, content, author = "匿名用户") {
  const comments = readComments();
  const now = Date.now();
  const comment = {
    id: crypto.randomUUID().slice(0, 8),
    postId,
    content,
    author,
    createdAt: now,
    likes: 0,
    replies: []
  };
  comments.unshift(comment);
  writeComments(comments);
  return comment;
}

export function addReply(commentId, content, author = "匿名用户") {
  const comments = readComments();
  const now = Date.now();
  const reply = {
    id: crypto.randomUUID().slice(0, 8),
    content,
    author,
    createdAt: now,
    likes: 0
  };
  
  const updatedComments = comments.map(comment => {
    if (comment.id === commentId) {
      return {
        ...comment,
        replies: [...(comment.replies || []), reply]
      };
    }
    return comment;
  });
  
  writeComments(updatedComments);
  return reply;
}

export function likeComment(commentId) {
  const comments = readComments();
  const updatedComments = comments.map(comment => {
    if (comment.id === commentId) {
      return {
        ...comment,
        likes: (comment.likes || 0) + 1
      };
    }
    if (comment.replies) {
      return {
        ...comment,
        replies: comment.replies.map(reply => {
          if (reply.id === commentId) {
            return {
              ...reply,
              likes: (reply.likes || 0) + 1
            };
          }
          return reply;
        })
      };
    }
    return comment;
  });
  writeComments(updatedComments);
  return true;
}

export function deleteComment(commentId) {
  const comments = readComments();
  const updatedComments = comments.filter(comment => {
    if (comment.id === commentId) {
      return false;
    }
    if (comment.replies) {
      comment.replies = comment.replies.filter(reply => reply.id !== commentId);
    }
    return true;
  });
  writeComments(updatedComments);
  return true;
}
