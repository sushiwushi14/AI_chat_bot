import pytest
from typing import Annotated, List
from typing_extensions import TypedDict
from unittest.mock import MagicMock

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

from app.graph import State, build_superbot_node, prepare_input_messages


class MockStreamingLLM(BaseChatModel):
    """Mock LLM for isolated unit testing of LangGraph nodes and checkpoints."""
    responses: List[str] = ["Response turn 1", "Response turn 2"]
    call_count: int = 0

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        content = self.responses[min(self.call_count, len(self.responses) - 1)]
        self.call_count += 1
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=content))])

    @property
    def _llm_type(self) -> str:
        return "mock-chat"


def test_superbot_node_contract():
    """Verify SuperBot node conforms to State schema {'messages': [response]}."""
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = AIMessage(content="Hello from mock!")

    node_func = build_superbot_node(mock_llm)
    state: State = {"messages": [HumanMessage(content="Hello")]}
    result = node_func(state)

    assert "messages" in result
    assert len(result["messages"]) == 1
    assert result["messages"][0].content == "Hello from mock!"
    mock_llm.invoke.assert_called_once()


def test_conversation_memory_across_turns():
    """Verify checkpointer preserves state between multiple invocations."""
    llm = MockStreamingLLM(responses=[
        "Hello Krish, nice to meet you!",
        "Your name is Krish."
    ])
    node_func = build_superbot_node(llm)

    builder = StateGraph(State)
    builder.add_node("SuperBot", node_func)
    builder.add_edge(START, "SuperBot")
    builder.add_edge("SuperBot", END)
    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)

    thread_config = {"configurable": {"thread_id": "test_krish_memory"}}

    # Turn 1
    input_msgs1 = prepare_input_messages(
        graph=graph,
        thread_id="test_krish_memory",
        user_message="Hi, my name is Krish and I like cricket.",
        system_prompt="You are a helpful assistant."
    )
    # Check that system prompt is added on turn 1
    assert isinstance(input_msgs1[0], SystemMessage)
    assert isinstance(input_msgs1[1], HumanMessage)

    out1 = graph.invoke({"messages": input_msgs1}, config=thread_config)
    assert out1["messages"][-1].content == "Hello Krish, nice to meet you!"

    # Turn 2: only send user message, checkpointer preserves Turn 1
    input_msgs2 = prepare_input_messages(
        graph=graph,
        thread_id="test_krish_memory",
        user_message="What is my name?"
    )
    # Check that system prompt is NOT re-added on turn 2
    assert len(input_msgs2) == 1
    assert isinstance(input_msgs2[0], HumanMessage)

    out2 = graph.invoke({"messages": input_msgs2}, config=thread_config)
    # Total messages in state should be System + Human1 + AI1 + Human2 + AI2 = 5
    assert len(out2["messages"]) == 5
    assert out2["messages"][-1].content == "Your name is Krish."
