import React, { useMemo, useState } from "react";
import { getSafeRemoteUrl } from "@/src/lib/security/url";

type CommentAuthor = {
	id: string;
	name: string;
	avatarUrl: string;
	level: number;
	region?: string;
};

export type CommentReply = {
	id: string;
	author: CommentAuthor;
	content: string;
	date: string;
	likes?: number;
	replyTo?: string;
};

export type RootComment = {
	id: string;
	author: CommentAuthor;
	content: string;
	date: string;
	likes: number;
	replies: CommentReply[];
};

export type BilibiliCommentThreadProps = {
	comments: RootComment[];
	previewCount?: number;
	onReply?: (payload: { commentId: string; replyId?: string }) => void;
	onLike?: (payload: { commentId: string; replyId?: string }) => void;
};

type IconProps = React.ComponentProps<"svg">;

const ChevronRightIcon: React.FC<IconProps> = (props) => (
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
		<path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const HeartIcon: React.FC<IconProps> = (props) => (
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
		<path
			d="M8 13.4 2.9 8.7a3.3 3.3 0 0 1 4.7-4.7L8 4.7l.4-.7a3.3 3.3 0 0 1 4.7 4.7L8 13.4Z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const MessageCircleIcon: React.FC<IconProps> = (props) => (
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
		<path
			d="M4 11.5 1.8 14v-3.4A5.7 5.7 0 0 1 1 8c0-3.3 3.1-6 7-6s7 2.7 7 6-3.1 6-7 6c-1.4 0-2.7-.3-4-.9Z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const MoreHorizontalIcon: React.FC<IconProps> = (props) => (
	<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
		<circle cx="3" cy="8" r="1.2" />
		<circle cx="8" cy="8" r="1.2" />
		<circle cx="13" cy="8" r="1.2" />
	</svg>
);

function getAvatarInitial(name: string) {
	const trimmed = name.trim();
	return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

const SafeAvatar: React.FC<{ src?: string; name: string; className: string }> = ({
	src,
	name,
	className,
}) => {
	const safeSrc = useMemo(() => getSafeRemoteUrl(src), [src]);
	const [loadFailed, setLoadFailed] = useState(false);

	React.useEffect(() => {
		setLoadFailed(false);
	}, [safeSrc]);

	if (!safeSrc || loadFailed) {
		return (
			<div
				aria-hidden="true"
				className={`${className} flex items-center justify-center bg-[#2a2a2a] text-xs font-semibold text-[#d9d9d9]`}
			>
				{getAvatarInitial(name)}
			</div>
		);
	}

	return (
		<img
			src={safeSrc}
			alt={name}
			className={`${className} object-cover`}
			onError={() => setLoadFailed(true)}
		/>
	);
};

const LevelBadge: React.FC<{ level: number }> = ({ level }) => (
	<span className="rounded-sm bg-[#2d2d2d] px-1.5 text-[10px] font-semibold text-[#7fd2ff]">
		LV{level}
	</span>
);

const RootCommentItem: React.FC<{
	comment: RootComment;
	previewCount: number;
	expanded: boolean;
	onToggleReplies: (commentId: string) => void;
	onReply?: BilibiliCommentThreadProps["onReply"];
	onLike?: BilibiliCommentThreadProps["onLike"];
}> = ({
	comment,
	previewCount,
	expanded,
	onToggleReplies,
	onReply,
	onLike,
}) => {
	const visibleReplies = useMemo(() => {
		if (expanded) {
			return comment.replies;
		}

		return comment.replies.slice(0, previewCount);
	}, [comment.replies, expanded, previewCount]);

	return (
		<article className="rounded-[10px] bg-[#111] p-4 text-white">
			<div className="flex gap-3">
				<SafeAvatar src={comment.author.avatarUrl} name={comment.author.name} className="h-10 w-10 rounded-full" />

				<div className="flex-1">
					<header className="flex items-start gap-2">
						<div className="flex flex-1 flex-col gap-0.5">
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium text-white">
									{comment.author.name}
								</span>
								<LevelBadge level={comment.author.level} />
								{comment.author.region && (
									<span className="text-[10px] text-[#7a7a7a]">
										{comment.author.region}
									</span>
								)}
							</div>
							<p className="text-sm leading-[22px] text-[#f2f2f2]">
								{comment.content}
							</p>
						</div>

						<button
							type="button"
							aria-label="更多操作"
							className="text-[#6c6c6c] transition-colors hover:text-white"
						>
							<MoreHorizontalIcon className="h-4 w-4" />
						</button>
					</header>

					<footer className="mt-3 flex items-center gap-4 text-xs text-[#7c7c7c]">
						<span>{comment.date}</span>
						<button
							type="button"
							className="flex items-center gap-1 text-[#6e9bff]"
							onClick={() => onReply?.({ commentId: comment.id })}
						>
							<MessageCircleIcon className="h-3.5 w-3.5" /> 回复
						</button>
						<button
							type="button"
							className="flex items-center gap-1 text-[#7c7c7c] transition-colors hover:text-white"
							onClick={() => onLike?.({ commentId: comment.id })}
						>
							<HeartIcon className="h-3.5 w-3.5" />
							{comment.likes}
						</button>
					</footer>

					{comment.replies.length > 0 && (
						<section className="mt-3 ml-12 rounded-[12px] bg-[#1c1c1c] p-3">
							<div className="flex flex-col gap-2">
								{visibleReplies.map((reply) => (
									<div className="flex gap-2" key={reply.id}>
										<SafeAvatar
											src={reply.author.avatarUrl}
											name={reply.author.name}
											className="mt-0.5 h-6 w-6 rounded-full"
										/>
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-xs font-medium text-white">
													{reply.author.name}
												</span>
												<LevelBadge level={reply.author.level} />
											</div>
											<p className="mt-1 text-[13px] leading-[18px] text-[#f5f5f5]">
												{reply.replyTo && (
													<span className="text-[#6e9bff]">
														@{reply.replyTo}&nbsp;
													</span>
												)}
												{reply.content}
											</p>
											<div className="mt-1 flex items-center gap-3 text-[11px] text-[#7c7c7c]">
												<span>{reply.date}</span>
												<button
													type="button"
													className="text-[#6e9bff]"
													onClick={() =>
														onReply?.({ commentId: comment.id, replyId: reply.id })
													}
												>
													回复
												</button>
												<button
													type="button"
													className="flex items-center gap-1 text-[#7c7c7c] transition-colors hover:text-white"
													onClick={() =>
														onLike?.({ commentId: comment.id, replyId: reply.id })
													}
												>
													<HeartIcon className="h-3 w-3" />
													{reply.likes ?? 0}
												</button>
											</div>
										</div>
									</div>
								))}
							</div>

							{comment.replies.length > visibleReplies.length && (
								<button
									type="button"
									className="ml-8 mt-2 flex items-center gap-1 text-xs font-medium text-[#6e9bff]"
									onClick={() => onToggleReplies(comment.id)}
								>
									<ChevronRightIcon className="h-3 w-3" /> 共
									{comment.replies.length}
									条回复 &gt;
								</button>
							)}

							{expanded && comment.replies.length > previewCount && (
								<button
									type="button"
									className="ml-8 mt-2 flex items-center gap-1 text-xs font-medium text-[#6e9bff]"
									onClick={() => onToggleReplies(comment.id)}
								>
									<ChevronRightIcon className="h-3 w-3 rotate-90" /> 收起回复
								</button>
							)}
						</section>
					)}
				</div>
			</div>
		</article>
	);
};

export const BilibiliCommentThread: React.FC<BilibiliCommentThreadProps> = ({
	comments,
	previewCount = 2,
	onReply,
	onLike,
}) => {
	const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
	const resolvedPreviewCount = Number.isFinite(previewCount) ? Math.max(0, Math.floor(previewCount)) : 2;

	const handleToggle = (commentId: string) => {
		setExpandedComments((state) => ({
			...state,
			[commentId]: !state[commentId],
		}));
	};

	return (
		<div className="space-y-4 bg-[#0d0d0d] p-4">
			{comments.length ? (
				comments.map((comment) => (
					<RootCommentItem
						key={comment.id}
						comment={comment}
						previewCount={resolvedPreviewCount}
						expanded={!!expandedComments[comment.id]}
						onToggleReplies={handleToggle}
						onReply={onReply}
						onLike={onLike}
					/>
				))
			) : (
				<div className="rounded-[10px] border border-dashed border-[#2b2b2b] bg-[#111] px-4 py-8 text-center text-sm text-[#8b8b8b]">
					暂无评论，来抢沙发吧
				</div>
			)}
		</div>
	);
};

export const sampleBilibiliComments: RootComment[] = [
	{
		id: "1",
		author: {
			id: "wing2207",
			name: "Wing2207",
			avatarUrl:
				"https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
			level: 6,
			region: "广东",
		},
		content: "原来是用这种方式解决的吗😲",
		date: "2023年1月14日",
		likes: 36,
		replies: [
			{
				id: "1-1",
				author: {
					id: "reply-user",
					name: "UP主",
					avatarUrl:
						"https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80",
					level: 5,
				},
				content: "哈哈对的，这样稳定多了~",
				date: "2023年1月15日",
				likes: 12,
			},
			{
				id: "1-2",
				author: {
					id: "fan-a",
					name: "帕克是我梦",
					avatarUrl:
						"https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
					level: 5,
				},
				replyTo: "UP主",
				content: "不是，这怎么胡的？",
				date: "2023年1月16日",
				likes: 4,
			},
		],
	},
	{
		id: "2",
		author: {
			id: "le0na",
			name: "Le0na",
			avatarUrl:
				"https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
			level: 6,
			region: "安徽",
		},
		content: "暴露键盘力了",
		date: "2023年1月30日",
		likes: 1,
		replies: [
			{
				id: "2-1",
				author: {
					id: "up",
					name: "UP主",
					avatarUrl:
						"https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80",
					level: 5,
				},
				content: "实际我键盘到现在还只能玩2k音游",
				date: "2023年1月30日",
				likes: 3,
			},
		],
	},
];

export const BilibiliCommentDemo = () => (
	<div className="min-h-screen bg-[#050505]">
		<BilibiliCommentThread comments={sampleBilibiliComments} />
	</div>
);
