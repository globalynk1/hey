import NewAttachments from "@components/Composer/NewAttachments";
import QuotedPost from "@components/Publication/QuotedPost";
import { AudioPublicationSchema } from "@components/Shared/Audio";
import Wrapper from "@components/Shared/Embed/Wrapper";
import errorToast from "@helpers/errorToast";
import { Leafwatch } from "@helpers/leafwatch";
import uploadMetadata from "@helpers/uploadMetadata";
import { KNOWN_ATTRIBUTES, METADATA_ENDPOINT } from "@hey/data/constants";
import { Errors } from "@hey/data/errors";
import { PUBLICATION } from "@hey/data/tracking";
import checkDispatcherPermissions from "@hey/helpers/checkDispatcherPermissions";
import collectModuleParams from "@hey/helpers/collectModuleParams";
import getMentions from "@hey/helpers/getMentions";
import getProfile from "@hey/helpers/getProfile";
import removeQuoteOn from "@hey/helpers/removeQuoteOn";
import type {
  MirrorablePublication,
  MomokaCommentRequest,
  MomokaPostRequest,
  MomokaQuoteRequest,
  OnchainCommentRequest,
  OnchainPostRequest,
  OnchainQuoteRequest,
  Quote
} from "@hey/lens";
import { ReferenceModuleType } from "@hey/lens";
import type { IGif } from "@hey/types/giphy";
import type { NewAttachment } from "@hey/types/misc";
import { Button, Card, ErrorMessage, H6 } from "@hey/ui";
import { MetadataAttributeType } from "@lens-protocol/metadata";
import dynamic from "next/dynamic";
import type { FC } from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useCreatePoll from "src/hooks/useCreatePoll";
import useCreatePublication from "src/hooks/useCreatePublication";
import usePublicationMetadata from "src/hooks/usePublicationMetadata";
import { useCollectModuleStore } from "src/store/non-persisted/publication/useCollectModuleStore";
import { usePostAttachmentStore } from "src/store/non-persisted/publication/usePostAttachmentStore";
import {
  DEFAULT_VIDEO_THUMBNAIL,
  usePostVideoStore
} from "src/store/non-persisted/publication/usePostVideoStore";
import { usePublicationAttributesStore } from "src/store/non-persisted/publication/usePublicationAttributesStore";
import {
  DEFAULT_AUDIO_PUBLICATION,
  usePublicationAudioStore
} from "src/store/non-persisted/publication/usePublicationAudioStore";
import { usePublicationLicenseStore } from "src/store/non-persisted/publication/usePublicationLicenseStore";
import { usePublicationLiveStore } from "src/store/non-persisted/publication/usePublicationLiveStore";
import { usePublicationPollStore } from "src/store/non-persisted/publication/usePublicationPollStore";
import { usePublicationStore } from "src/store/non-persisted/publication/usePublicationStore";
import { useGlobalModalStateStore } from "src/store/non-persisted/useGlobalModalStateStore";
import { useNonceStore } from "src/store/non-persisted/useNonceStore";
import { useProfileStatus } from "src/store/non-persisted/useProfileStatus";
import { useReferenceModuleStore } from "src/store/non-persisted/useReferenceModuleStore";
import { useProfileStore } from "src/store/persisted/useProfileStore";
import LivestreamEditor from "./Actions/LivestreamSettings/LivestreamEditor";
import PollEditor from "./Actions/PollSettings/PollEditor";
import { Editor, useEditorContext, withEditorContext } from "./Editor";
import LinkPreviews from "./LinkPreviews";

const Shimmer = <div className="shimmer mb-1 size-5 rounded-lg" />;

const Attachment = dynamic(
  () => import("@components/Composer/Actions/Attachment"),
  { loading: () => Shimmer }
);
const EmojiPicker = dynamic(() => import("@components/Shared/EmojiPicker"), {
  loading: () => Shimmer
});
const Gif = dynamic(() => import("@components/Composer/Actions/Gif"), {
  loading: () => Shimmer
});
const CollectSettings = dynamic(
  () => import("@components/Composer/Actions/CollectSettings"),
  { loading: () => Shimmer }
);
const ReferenceSettings = dynamic(
  () => import("@components/Composer/Actions/ReferenceSettings"),
  { loading: () => Shimmer }
);
const PollSettings = dynamic(
  () => import("@components/Composer/Actions/PollSettings"),
  { loading: () => Shimmer }
);
const LivestreamSettings = dynamic(
  () => import("@components/Composer/Actions/LivestreamSettings"),
  { loading: () => Shimmer }
);

interface NewPublicationProps {
  className?: string;
  post?: MirrorablePublication;
}

const NewPublication: FC<NewPublicationProps> = ({ className, post }) => {
  const { currentProfile } = useProfileStore();
  const { isSuspended } = useProfileStatus();

  // Global modal store
  const { setShowNewPostModal } = useGlobalModalStateStore();

  // Nonce store
  const { lensHubOnchainSigNonce } = useNonceStore();

  // Publication store
  const {
    publicationContent,
    quotedPost,
    setPublicationContent,
    setQuotedPost,
    setTags
  } = usePublicationStore();

  // Audio store
  const { audioPublication, setAudioPublication } = usePublicationAudioStore();

  // Video store
  const { setVideoThumbnail, videoThumbnail } = usePostVideoStore();

  // Live video store
  const { resetLiveVideoConfig, setShowLiveVideoEditor, showLiveVideoEditor } =
    usePublicationLiveStore();

  // Attachment store
  const { addAttachments, attachments, isUploading, setAttachments } =
    usePostAttachmentStore((state) => state);

  // Poll store
  const { pollConfig, resetPollConfig, setShowPollEditor, showPollEditor } =
    usePublicationPollStore();

  // License store
  const { setLicense } = usePublicationLicenseStore();

  // Collect module store
  const { collectModule, reset: resetCollectSettings } = useCollectModuleStore(
    (state) => state
  );

  // Reference module store
  const { degreesOfSeparation, onlyFollowers, selectedReferenceModule } =
    useReferenceModuleStore();

  // Attributes store
  const { reset: resetAttributes } = usePublicationAttributesStore();

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [publicationContentError, setPublicationContentError] = useState("");
  const [exceededMentionsLimit, setExceededMentionsLimit] = useState(false);

  const editor = useEditorContext();
  const createPoll = useCreatePoll();
  const getMetadata = usePublicationMetadata();

  const { canUseLensManager } = checkDispatcherPermissions(currentProfile);

  const isComment = Boolean(post);
  const isQuote = Boolean(quotedPost);
  const hasAudio = attachments[0]?.type === "Audio";
  const hasVideo = attachments[0]?.type === "Video";

  const noCollect = !collectModule.type;
  // Use Momoka if the profile the comment or quote has momoka proof and also check collect module has been disabled
  const useMomoka = isComment
    ? post?.momoka?.proof
    : isQuote
      ? quotedPost?.momoka?.proof
      : noCollect;

  const reset = () => {
    editor?.setMarkdown("");
    setIsLoading(false);
    setPublicationContent("");
    setTags(null);
    setShowPollEditor(false);
    resetPollConfig();
    setShowLiveVideoEditor(false);
    resetLiveVideoConfig();
    setAttachments([]);
    setQuotedPost(null);
    setVideoThumbnail(DEFAULT_VIDEO_THUMBNAIL);
    setAudioPublication(DEFAULT_AUDIO_PUBLICATION);
    setLicense(null);
    resetAttributes();
    resetCollectSettings();
    setShowNewPostModal(false);
  };

  const onError = (error?: any) => {
    setIsLoading(false);
    errorToast(error);
  };

  const onCompleted = (
    __typename?:
      | "CreateMomokaPublicationResult"
      | "LensProfileManagerRelayError"
      | "RelayError"
      | "RelaySuccess"
  ) => {
    if (
      __typename === "RelayError" ||
      __typename === "LensProfileManagerRelayError"
    ) {
      return onError();
    }

    // Reset states
    reset();

    // Track in leafwatch
    const eventProperties = {
      comment_on: isComment ? post?.id : null,
      publication_collect_module: collectModule.type,
      publication_has_attachments: attachments.length > 0,
      publication_has_poll: showPollEditor,
      publication_is_live: showLiveVideoEditor,
      publication_reference_module: selectedReferenceModule,
      publication_reference_module_degrees_of_separation:
        selectedReferenceModule ===
        ReferenceModuleType.DegreesOfSeparationReferenceModule
          ? degreesOfSeparation
          : null,
      quote_on: isQuote ? quotedPost?.id : null
    };
    Leafwatch.track(
      isComment
        ? PUBLICATION.NEW_COMMENT
        : isQuote
          ? PUBLICATION.NEW_QUOTE
          : PUBLICATION.NEW_POST,
      eventProperties
    );
  };

  const {
    createCommentOnChain,
    createCommentOnMomka,
    createMomokaCommentTypedData,
    createMomokaPostTypedData,
    createMomokaQuoteTypedData,
    createOnchainCommentTypedData,
    createOnchainPostTypedData,
    createOnchainQuoteTypedData,
    createPostOnChain,
    createPostOnMomka,
    createQuoteOnChain,
    createQuoteOnMomka,
    error
  } = useCreatePublication({
    commentOn: post,
    onCompleted,
    onError,
    quoteOn: quotedPost as Quote
  });

  useEffect(() => {
    setPublicationContentError("");
  }, [audioPublication]);

  useEffect(() => {
    if (getMentions(publicationContent).length > 50) {
      setExceededMentionsLimit(true);
      setPublicationContentError("You can only mention 50 people at a time!");
    } else {
      setExceededMentionsLimit(false);
      setPublicationContentError("");
    }
  }, [publicationContent]);

  const getAnimationUrl = () => {
    const fallback =
      "ipfs://bafkreiaoua5s4iyg4gkfjzl6mzgenw4qw7mwgxj7zf7ev7gga72o5d3lf4";

    if (attachments.length > 0 || hasAudio || hasVideo) {
      return attachments[0]?.uri || fallback;
    }

    return fallback;
  };

  const getTitlePrefix = () => {
    if (hasVideo) {
      return "Video";
    }

    return isComment ? "Comment" : isQuote ? "Quote" : "Post";
  };

  const handleCreatePublication = async () => {
    if (!currentProfile) {
      return toast.error(Errors.SignWallet);
    }

    if (isSuspended) {
      return toast.error(Errors.Suspended);
    }

    try {
      setIsLoading(true);
      if (hasAudio) {
        setPublicationContentError("");
        const parsedData = AudioPublicationSchema.safeParse(audioPublication);
        if (!parsedData.success) {
          const issue = parsedData.error.issues[0];
          setIsLoading(false);
          return setPublicationContentError(issue.message);
        }
      }

      if (publicationContent.length === 0 && attachments.length === 0) {
        setIsLoading(false);
        return setPublicationContentError(
          `${
            isComment ? "Comment" : isQuote ? "Quote" : "Post"
          } should not be empty!`
        );
      }

      setPublicationContentError("");

      let pollId: string | undefined;
      if (showPollEditor) {
        pollId = await createPoll();
      }

      const processedPublicationContent =
        publicationContent.length > 0 ? publicationContent : undefined;
      const title = hasAudio
        ? audioPublication.title
        : `${getTitlePrefix()} by ${getProfile(currentProfile).slugWithPrefix}`;
      const hasAttributes = Boolean(pollId);

      const baseMetadata = {
        content: processedPublicationContent,
        title,
        ...(hasAttributes && {
          attributes: [
            ...(pollId
              ? [
                  {
                    key: KNOWN_ATTRIBUTES.POLL_ID,
                    type: MetadataAttributeType.STRING,
                    value: pollId
                  }
                ]
              : [])
          ]
        }),
        marketplace: {
          animation_url: getAnimationUrl(),
          description: processedPublicationContent,
          external_url: `https://hey.xyz${getProfile(currentProfile).link}`,
          name: title
        }
      };

      const metadata = getMetadata({ baseMetadata });
      const metadataId = await uploadMetadata(metadata);

      // Payload for the open action module
      const openActionModules = [];

      if (collectModule.type) {
        openActionModules.push({
          collectOpenAction: collectModuleParams(collectModule)
        });
      }

      // Payload for the Momoka post/comment/quote
      const momokaRequest:
        | MomokaCommentRequest
        | MomokaPostRequest
        | MomokaQuoteRequest = {
        ...(isComment && { commentOn: post?.id }),
        ...(isQuote && { quoteOn: quotedPost?.id }),
        contentURI: `${METADATA_ENDPOINT}/${metadataId}`
      };

      if (useMomoka) {
        if (canUseLensManager) {
          if (isComment) {
            return await createCommentOnMomka(
              momokaRequest as MomokaCommentRequest
            );
          }

          if (isQuote) {
            return await createQuoteOnMomka(
              momokaRequest as MomokaQuoteRequest
            );
          }

          return await createPostOnMomka(momokaRequest);
        }

        if (isComment) {
          return await createMomokaCommentTypedData({
            variables: { request: momokaRequest as MomokaCommentRequest }
          });
        }

        if (isQuote) {
          return await createMomokaQuoteTypedData({
            variables: { request: momokaRequest as MomokaQuoteRequest }
          });
        }

        return await createMomokaPostTypedData({
          variables: { request: momokaRequest }
        });
      }

      // Payload for the post/comment/quote
      const onChainRequest:
        | OnchainCommentRequest
        | OnchainPostRequest
        | OnchainQuoteRequest = {
        contentURI: `${METADATA_ENDPOINT}/${metadataId}`,
        ...(isComment && { commentOn: post?.id }),
        ...(isQuote && { quoteOn: quotedPost?.id }),
        openActionModules,
        ...(onlyFollowers && {
          referenceModule:
            selectedReferenceModule ===
            ReferenceModuleType.FollowerOnlyReferenceModule
              ? { followerOnlyReferenceModule: true }
              : {
                  degreesOfSeparationReferenceModule: {
                    commentsRestricted: true,
                    degreesOfSeparation,
                    mirrorsRestricted: true,
                    quotesRestricted: true
                  }
                }
        })
      };

      if (canUseLensManager) {
        if (isComment) {
          return await createCommentOnChain(
            onChainRequest as OnchainCommentRequest
          );
        }

        if (isQuote) {
          return await createQuoteOnChain(
            onChainRequest as OnchainQuoteRequest
          );
        }

        return await createPostOnChain(onChainRequest);
      }

      if (isComment) {
        return await createOnchainCommentTypedData({
          variables: {
            options: { overrideSigNonce: lensHubOnchainSigNonce },
            request: onChainRequest as OnchainCommentRequest
          }
        });
      }

      if (isQuote) {
        return await createOnchainQuoteTypedData({
          variables: {
            options: { overrideSigNonce: lensHubOnchainSigNonce },
            request: onChainRequest as OnchainQuoteRequest
          }
        });
      }

      return await createOnchainPostTypedData({
        variables: {
          options: { overrideSigNonce: lensHubOnchainSigNonce },
          request: onChainRequest
        }
      });
    } catch (error) {
      onError(error);
    }
  };

  const setGifAttachment = (gif: IGif) => {
    const attachment: NewAttachment = {
      mimeType: "image/gif",
      previewUri: gif.images.original.url,
      type: "Image",
      uri: gif.images.original.url
    };
    addAttachments([attachment]);
  };

  const isSubmitDisabledByPoll = showPollEditor
    ? !pollConfig.options.length ||
      pollConfig.options.some((option) => !option.length)
    : false;

  return (
    <Card className={className} onClick={() => setShowEmojiPicker(false)}>
      {error ? (
        <ErrorMessage
          className="!rounded-none"
          error={error}
          title="Transaction failed!"
        />
      ) : null}
      <Editor />
      {publicationContentError ? (
        <H6 className="mt-1 px-5 pb-3 text-red-500">
          {publicationContentError}
        </H6>
      ) : null}
      {showPollEditor ? <PollEditor /> : null}
      {showLiveVideoEditor ? <LivestreamEditor /> : null}
      <LinkPreviews />
      <NewAttachments attachments={attachments} />
      {quotedPost ? (
        <Wrapper className="m-5" zeroPadding>
          <QuotedPost isNew post={removeQuoteOn(quotedPost as Quote)} />
        </Wrapper>
      ) : null}
      <div className="divider mx-5" />
      <div className="block items-center px-5 py-3 sm:flex">
        <div className="flex items-center space-x-4">
          <Attachment />
          <EmojiPicker
            setEmoji={(emoji: string) => {
              setShowEmojiPicker(false);
              editor?.insertText(emoji);
            }}
            setShowEmojiPicker={setShowEmojiPicker}
            showEmojiPicker={showEmojiPicker}
          />
          <Gif setGifAttachment={(gif: IGif) => setGifAttachment(gif)} />
          {post?.momoka?.proof ? null : (
            <>
              <CollectSettings />
              <ReferenceSettings />
            </>
          )}
          <PollSettings />
          {!isComment && <LivestreamSettings />}
        </div>
        <div className="mt-2 ml-auto sm:mt-0">
          <Button
            disabled={
              isLoading ||
              isUploading ||
              isSubmitDisabledByPoll ||
              videoThumbnail.uploading ||
              exceededMentionsLimit
            }
            onClick={handleCreatePublication}
          >
            {isComment ? "Comment" : "Post"}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default withEditorContext(NewPublication);
